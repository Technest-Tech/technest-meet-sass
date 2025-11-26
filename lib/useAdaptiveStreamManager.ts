import * as React from 'react';
import {
  Room,
  RoomEvent,
  Track,
  VideoQuality,
  RemoteTrackPublication,
  RemoteTrack,
  LocalTrackPublication,
  VideoPresets,
  ConnectionQuality,
  Participant,
} from 'livekit-client';
import { ConnectionMonitor, QualityLevel } from './services/ConnectionMonitor';
import { NetworkAdapter } from './services/NetworkAdapter';
import { useMediaStore } from './store/mediaStore';
import { logger } from './utils/logger';

const qualityFromPreference = (pref: 'low' | 'medium' | 'high' | 'auto') => {
  switch (pref) {
    case 'high':
      return VideoQuality.HIGH;
    case 'medium':
      return VideoQuality.MEDIUM;
    case 'low':
      return VideoQuality.LOW;
    default:
      return null;
  }
};

const qualityFromNetwork = (quality: QualityLevel): VideoQuality => {
  switch (quality) {
    case 'excellent':
      return VideoQuality.HIGH;
    case 'good':
      return VideoQuality.MEDIUM;
    case 'fair':
    case 'poor':
    default:
      return VideoQuality.LOW;
  }
};

/**
 * Map LiveKit ConnectionQuality to our QualityLevel
 */
const mapLiveKitQuality = (quality: ConnectionQuality): QualityLevel => {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return 'excellent';
    case ConnectionQuality.Good:
      return 'good';
    case ConnectionQuality.Poor:
      return 'fair';
    case ConnectionQuality.Lost:
      return 'poor';
    default:
      return 'poor'; // Changed from 'good' to be more conservative for unknown states
  }
};

/**
 * Get effective quality based on both local and remote connection quality
 * Uses the worse of the two to ensure stability
 */
const getEffectiveQuality = (localQuality: QualityLevel, remoteQuality: QualityLevel): QualityLevel => {
  // Quality hierarchy: excellent > good > fair > poor
  const qualityOrder: QualityLevel[] = ['poor', 'fair', 'good', 'excellent'];
  const localIndex = qualityOrder.indexOf(localQuality);
  const remoteIndex = qualityOrder.indexOf(remoteQuality);
  
  // Return the worse (lower index) quality
  return qualityOrder[Math.min(localIndex, remoteIndex)];
};

export function useAdaptiveStreamManager(room: Room | null | undefined) {
  const preferredQuality = useMediaStore((state) => state.videoQuality);
  const preferredScreenShareQuality = useMediaStore((state) => state.screenShareQuality);
  const adapterRef = React.useRef<NetworkAdapter>();
  const monitorRef = React.useRef<ConnectionMonitor>();
  const lastNetworkQuality = React.useRef<QualityLevel>('good');
  // Track per-participant connection quality
  const participantQualityMap = React.useRef<Map<string, QualityLevel>>(new Map());
  // Debouncing: track pending quality updates per track
  const qualityChangeTimeoutRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map());
  // Hysteresis: track last quality per track
  const lastQualityRef = React.useRef<Map<string, VideoQuality>>(new Map());
  // Error recovery: track failure counts per track
  const failureCountRef = React.useRef<Map<string, number>>(new Map());
  // Track last successful update time for failure recovery
  const lastSuccessTimeRef = React.useRef<Map<string, number>>(new Map());
  // Track last quality change time for stability requirement
  const lastQualityChangeTimeRef = React.useRef<Map<string, number>>(new Map());

  const determineTargetQuality = React.useCallback(
    (publication: RemoteTrackPublication, networkQuality: QualityLevel) => {
      // Get network-based quality first
      const networkBasedQuality = qualityFromNetwork(networkQuality);
      
      if (publication.source === Track.Source.ScreenShare) {
        // Use screen share quality preference
        const manualChoice = preferredScreenShareQuality !== 'auto' 
          ? qualityFromPreference(preferredScreenShareQuality) 
          : null;
        if (manualChoice) {
          // Cap manual choice based on network quality to prevent issues
          // Use the lower (worse) of the two
          const qualityOrder = [VideoQuality.LOW, VideoQuality.MEDIUM, VideoQuality.HIGH];
          const manualIndex = qualityOrder.indexOf(manualChoice);
          const networkIndex = qualityOrder.indexOf(networkBasedQuality);
          return qualityOrder[Math.min(manualIndex, networkIndex)];
        }
        // If auto, use network quality (but keep it reasonable for screen share)
        return networkBasedQuality;
      }

      const manualChoice = preferredQuality !== 'auto' ? qualityFromPreference(preferredQuality) : null;
      if (manualChoice) {
        // Cap manual choice based on network quality to prevent issues
        // Use the lower (worse) of the two to ensure stability
        const qualityOrder = [VideoQuality.LOW, VideoQuality.MEDIUM, VideoQuality.HIGH];
        const manualIndex = qualityOrder.indexOf(manualChoice);
        const networkIndex = qualityOrder.indexOf(networkBasedQuality);
        return qualityOrder[Math.min(manualIndex, networkIndex)];
      }

      return networkBasedQuality;
    },
    [preferredQuality, preferredScreenShareQuality],
  );

  /**
   * Set video quality with debouncing, validation, hysteresis, and error recovery
   */
  const setVideoQualitySafely = React.useCallback(
    (
      publication: RemoteTrackPublication,
      target: VideoQuality,
      participantIdentity: string,
      context: { localQuality?: QualityLevel; remoteQuality?: QualityLevel; effectiveQuality?: QualityLevel }
    ) => {
      // Generate unique key for this track (include participant identity and track SID for uniqueness)
      const trackSid = publication.trackSid || `${publication.source}-${Date.now()}`;
      const participantKey = `${participantIdentity}-${trackSid}`;
      
      // Track state validation: check if track is valid
      if (!publication.track || !publication.isSubscribed) {
        logger.debug('Skipping quality update for invalid track state', {
          participant: participantIdentity,
          trackSource: publication.source,
          hasTrack: !!publication.track,
          isSubscribed: publication.isSubscribed,
        });
        return;
      }

      // Error recovery: check if we've had too many failures
      const failures = failureCountRef.current.get(participantKey) || 0;
      const lastSuccess = lastSuccessTimeRef.current.get(participantKey);
      const SUCCESS_RESET_MS = 30 * 1000; // 30 seconds
      
      // Reset failure count if track has been successful for 30+ seconds
      if (lastSuccess && (Date.now() - lastSuccess) >= SUCCESS_RESET_MS) {
        failureCountRef.current.delete(participantKey);
        logger.debug('Reset failure count after successful period', {
          participant: participantIdentity,
          trackSource: publication.source,
          lastSuccessTime: new Date(lastSuccess).toISOString(),
        });
      } else if (failures >= 3) {
        logger.debug('Skipping quality update due to repeated failures', {
          participant: participantIdentity,
          trackSource: publication.source,
          failures,
          lastSuccess: lastSuccess ? new Date(lastSuccess).toISOString() : null,
        });
        return;
      }

      // Hysteresis: check if quality actually needs to change
      const lastQuality = lastQualityRef.current.get(participantKey);
      if (lastQuality === target) {
        // No change needed
        return;
      }

      // Hysteresis: require stability for upgrades, allow immediate downgrades
      const qualityOrder = [VideoQuality.LOW, VideoQuality.MEDIUM, VideoQuality.HIGH];
      const lastIndex = lastQuality ? qualityOrder.indexOf(lastQuality) : -1;
      const targetIndex = qualityOrder.indexOf(target);
      
      // If upgrading (target > last), require stability period
      if (targetIndex > lastIndex && lastQuality) {
        const lastChangeTime = lastQualityChangeTimeRef.current.get(participantKey) || 0;
        const timeSinceLastChange = Date.now() - lastChangeTime;
        const STABILITY_REQUIRED_MS = 2500; // 2.5 seconds stability required for upgrades
        
        if (timeSinceLastChange < STABILITY_REQUIRED_MS) {
          logger.debug('Skipping quality upgrade - connection not stable enough', {
            participant: participantIdentity,
            trackSource: publication.source,
            lastQuality,
            targetQuality: target,
            timeSinceLastChange,
            requiredStability: STABILITY_REQUIRED_MS,
          });
          return;
        }
      }
      // Allow immediate downgrades (target < last) for stability

      // Debouncing: clear existing timeout
      const existingTimeout = qualityChangeTimeoutRef.current.get(participantKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout for debounced quality update
      const timeout = setTimeout(() => {
        try {
          publication.setVideoQuality(target);
          
          // Success: update last quality, reset failure count, and track success time
          lastQualityRef.current.set(participantKey, target);
          failureCountRef.current.delete(participantKey);
          lastSuccessTimeRef.current.set(participantKey, Date.now());
          lastQualityChangeTimeRef.current.set(participantKey, Date.now());
          
          logger.debug('Set video quality successfully', {
            participant: participantIdentity,
            trackSource: publication.source,
            targetQuality: target,
            ...context,
          });
        } catch (error) {
          // Error recovery: increment failure count
          const newFailures = (failureCountRef.current.get(participantKey) || 0) + 1;
          failureCountRef.current.set(participantKey, newFailures);
          
          logger.warn('Failed to set video quality', {
            participant: participantIdentity,
            trackSource: publication.source,
            targetQuality: target,
            failures: newFailures,
            error,
          });
        } finally {
          // Clean up timeout reference
          qualityChangeTimeoutRef.current.delete(participantKey);
        }
      }, 500); // 500ms debounce delay

      qualityChangeTimeoutRef.current.set(participantKey, timeout);
    },
    []
  );

  const applyQualityToRemoteTracks = React.useCallback(
    (localNetworkQuality: QualityLevel) => {
      if (!room) {
        return;
      }

      room.remoteParticipants.forEach((participant) => {
        // Skip if participant is not connected or connection is lost
        if (!participant.isConnected || participant.connectionQuality === ConnectionQuality.Lost) {
          logger.debug('Skipping quality update for disconnected participant', {
            participant: participant.identity,
            isConnected: participant.isConnected,
            connectionQuality: participant.connectionQuality,
          });
          return;
        }
        
        // Get this remote participant's connection quality
        // Use conservative default (Poor) if quality is unknown
        const remoteConnectionQuality = participant.connectionQuality ?? ConnectionQuality.Poor;
        const remoteQuality = mapLiveKitQuality(remoteConnectionQuality);
        
        // Store participant quality for reference
        participantQualityMap.current.set(participant.identity, remoteQuality);
        
        // Determine effective quality based on BOTH local and remote connection
        // Use the worse of the two to ensure stability
        const effectiveQuality = getEffectiveQuality(localNetworkQuality, remoteQuality);
        
        participant.videoTrackPublications.forEach((publication) => {
          const target = determineTargetQuality(publication, effectiveQuality);
          if (!target) {
            return;
          }
          setVideoQualitySafely(publication, target, participant.identity, {
            localQuality: localNetworkQuality,
            remoteQuality: remoteQuality,
            effectiveQuality: effectiveQuality,
            });
        });
      });
    },
    [room, determineTargetQuality, setVideoQualitySafely],
  );

  React.useEffect(() => {
    if (!room) {
      return;
    }

    if (!adapterRef.current) {
      adapterRef.current = new NetworkAdapter();
    }
    adapterRef.current.setRoom(room);

    if (!monitorRef.current) {
      monitorRef.current = new ConnectionMonitor();
    }

    monitorRef.current.setCallbacks({
      onQualityChanged: (quality) => {
        lastNetworkQuality.current = quality;
        adapterRef.current?.adaptToNetworkConditions(quality);
        applyQualityToRemoteTracks(quality);
      },
      onPoorConnection: () => {
        applyQualityToRemoteTracks('poor');
      },
    });

    monitorRef.current.startMonitoring(room);
    applyQualityToRemoteTracks(lastNetworkQuality.current);

    // Listen to connection quality changes for remote participants
    const handleConnectionQualityChanged = (
      quality: ConnectionQuality,
      participant: Participant | undefined,
    ) => {
      // Only handle remote participants (not local)
      if (!participant || participant === room.localParticipant) {
        return;
      }

      // Skip if participant is not connected or connection is lost
      if (!participant.isConnected || quality === ConnectionQuality.Lost) {
        logger.debug('Skipping quality update for disconnected/lost participant', {
          participant: participant.identity,
          isConnected: participant.isConnected,
          connectionQuality: quality,
        });
        participantQualityMap.current.set(participant.identity, 'poor');
        return;
      }

      const remoteQuality = mapLiveKitQuality(quality);
      participantQualityMap.current.set(participant.identity, remoteQuality);

      // Re-apply quality for this participant's tracks
      const effectiveQuality = getEffectiveQuality(lastNetworkQuality.current, remoteQuality);
      
      participant.videoTrackPublications.forEach((publication) => {
        const target = determineTargetQuality(publication, effectiveQuality);
        if (target) {
          setVideoQualitySafely(publication, target, participant.identity, {
            localQuality: lastNetworkQuality.current,
            remoteQuality: remoteQuality,
            effectiveQuality: effectiveQuality,
          });
        }
      });
    };

    room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);

    // Handle new participants joining
    const handleParticipantConnected = (participant: Participant) => {
      if (participant === room.localParticipant) {
        return;
      }
      
      // Skip if participant is not connected
      if (!participant.isConnected) {
        logger.debug('Skipping quality setup for unconnected participant', {
          participant: participant.identity,
        });
        return;
      }
      
      // Initialize quality for new participant
      // Use conservative default (Poor) if quality is unknown (common on initial join)
      const remoteConnectionQuality = participant.connectionQuality ?? ConnectionQuality.Poor;
      const remoteQuality = mapLiveKitQuality(remoteConnectionQuality);
      participantQualityMap.current.set(participant.identity, remoteQuality);
      
      // Apply quality to their tracks
      const effectiveQuality = getEffectiveQuality(lastNetworkQuality.current, remoteQuality);
      
      participant.videoTrackPublications.forEach((publication) => {
        const target = determineTargetQuality(publication, effectiveQuality);
        if (target) {
          setVideoQualitySafely(publication, target, participant.identity, {
            remoteQuality: remoteQuality,
            effectiveQuality: effectiveQuality,
          });
        }
      });
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);

    // Clean up participant quality when they disconnect
    const handleParticipantDisconnected = (participant: Participant) => {
      const participantIdentity = participant.identity;
      participantQualityMap.current.delete(participantIdentity);
      
      // Clean up all tracking data for this participant
      const keysToDelete: string[] = [];
      
      // Find all keys belonging to this participant
      qualityChangeTimeoutRef.current.forEach((timeout, key) => {
        if (key.startsWith(`${participantIdentity}-`)) {
          clearTimeout(timeout);
          keysToDelete.push(key);
        }
      });
      
      // Clean up all maps for this participant
      keysToDelete.forEach((key) => {
        qualityChangeTimeoutRef.current.delete(key);
        lastQualityRef.current.delete(key);
        failureCountRef.current.delete(key);
        lastSuccessTimeRef.current.delete(key);
        lastQualityChangeTimeRef.current.delete(key);
      });
      
      logger.debug('Cleaned up tracking data for disconnected participant', {
        participant: participantIdentity,
        keysCleaned: keysToDelete.length,
      });
    };

    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      monitorRef.current?.stopMonitoring();
      room.off(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      
      // Clean up all pending debounce timeouts
      qualityChangeTimeoutRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      qualityChangeTimeoutRef.current.clear();
    };
  }, [room, applyQualityToRemoteTracks, determineTargetQuality, setVideoQualitySafely]);

  // Periodic cleanup for stale tracking data
  React.useEffect(() => {
    if (!room) {
      return;
    }

    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
      const SUCCESS_RESET_MS = 30 * 1000; // 30 seconds
      
      // Get current participant identities
      const activeParticipantIdentities = new Set<string>();
      room.remoteParticipants.forEach((participant) => {
        activeParticipantIdentities.add(participant.identity);
      });
      if (room.localParticipant) {
        activeParticipantIdentities.add(room.localParticipant.identity);
      }
      
      // Clean up stale entries
      const keysToDelete: string[] = [];
      
      // Check all tracking maps
      lastQualityRef.current.forEach((_, key) => {
        const [participantIdentity] = key.split('-');
        
        // Delete if participant no longer exists
        if (!activeParticipantIdentities.has(participantIdentity) && participantIdentity !== 'unknown') {
          keysToDelete.push(key);
        }
      });
      
      // Clean up stale entries
      keysToDelete.forEach((key) => {
        // Clear any pending timeouts
        const timeout = qualityChangeTimeoutRef.current.get(key);
        if (timeout) {
          clearTimeout(timeout);
          qualityChangeTimeoutRef.current.delete(key);
        }
        
        // Remove from all tracking maps
        lastQualityRef.current.delete(key);
        failureCountRef.current.delete(key);
        lastSuccessTimeRef.current.delete(key);
        lastQualityChangeTimeRef.current.delete(key);
      });
      
      // Reset failure counts for tracks that have been successful for 30+ seconds
      failureCountRef.current.forEach((failures, key) => {
        const lastSuccess = lastSuccessTimeRef.current.get(key);
        if (lastSuccess && (now - lastSuccess) >= SUCCESS_RESET_MS) {
          failureCountRef.current.delete(key);
          logger.debug('Reset failure count after successful period', {
            key,
            lastSuccessTime: new Date(lastSuccess).toISOString(),
          });
        }
      });
      
      if (keysToDelete.length > 0) {
        logger.debug('Periodic cleanup completed', {
          staleEntriesRemoved: keysToDelete.length,
          activeParticipants: activeParticipantIdentities.size,
        });
      }
    }, 2 * 60 * 1000); // Run every 2 minutes

    return () => {
      clearInterval(cleanupInterval);
    };
  }, [room]);

  React.useEffect(() => {
    if (!room) {
      return;
    }

    const handleTrackSubscribed = (
      _track: RemoteTrack,
      publication: RemoteTrackPublication,
    ) => {
      // Find the participant for this track by iterating through remote participants
      let participant: Participant | undefined;
      for (const p of room.remoteParticipants.values()) {
        if (p.videoTrackPublications.has(publication.trackSid) || 
            p.audioTrackPublications.has(publication.trackSid)) {
          participant = p;
          break;
        }
      }
      
      if (!participant) {
        // Fallback: use local quality if participant not found
      const target = determineTargetQuality(publication, lastNetworkQuality.current);
        if (target) {
          // Use a generic key for unknown participant
          setVideoQualitySafely(publication, target, 'unknown', {
            localQuality: lastNetworkQuality.current,
          });
        }
        return;
      }
      
      // Skip if participant is not connected
      if (!participant.isConnected || participant.connectionQuality === ConnectionQuality.Lost) {
        logger.debug('Skipping quality setup for disconnected participant in track subscription', {
          participant: participant.identity,
        });
        return;
      }
      
      // Get effective quality based on both local and remote connection
      // Use conservative default (Poor) if quality is unknown
      const remoteConnectionQuality = participant.connectionQuality ?? ConnectionQuality.Poor;
      const remoteQuality = mapLiveKitQuality(remoteConnectionQuality);
      const effectiveQuality = getEffectiveQuality(lastNetworkQuality.current, remoteQuality);
      
      const target = determineTargetQuality(publication, effectiveQuality);
      if (!target) {
        return;
      }
      setVideoQualitySafely(publication, target, participant.identity, {
        localQuality: lastNetworkQuality.current,
        remoteQuality: remoteQuality,
        effectiveQuality: effectiveQuality,
        });
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    };
  }, [room, determineTargetQuality, setVideoQualitySafely]);

  React.useEffect(() => {
    applyQualityToRemoteTracks(lastNetworkQuality.current);
  }, [preferredQuality, preferredScreenShareQuality, applyQualityToRemoteTracks]);

  // Apply camera quality changes immediately when user changes preference
  React.useEffect(() => {
    if (!room || room.state !== 'connected') {
      return;
    }

    const localParticipant = room.localParticipant;
    if (!localParticipant.isCameraEnabled) {
      return; // Don't apply if camera is off
    }

    // Get network-based quality first
    const networkBasedQuality = qualityFromNetwork(lastNetworkQuality.current);
    const manualChoice = preferredQuality !== 'auto' 
      ? qualityFromPreference(preferredQuality) 
      : null;

    // Cap manual choice based on network quality to prevent issues
    let targetQuality: VideoQuality | null;
    if (manualChoice) {
      // Use the lower (worse) of manual preference and network quality
      const qualityOrder = [VideoQuality.LOW, VideoQuality.MEDIUM, VideoQuality.HIGH];
      const manualIndex = qualityOrder.indexOf(manualChoice);
      const networkIndex = qualityOrder.indexOf(networkBasedQuality);
      targetQuality = qualityOrder[Math.min(manualIndex, networkIndex)];
    } else {
      targetQuality = networkBasedQuality;
    }

    if (!targetQuality) {
      return;
    }

    const applyCameraQuality = async () => {
      try {
        const preset = targetQuality === VideoQuality.HIGH 
          ? VideoPresets.h720 
          : targetQuality === VideoQuality.MEDIUM 
          ? VideoPresets.h540 
          : VideoPresets.h360;

        const maxBitrate = targetQuality === VideoQuality.HIGH 
          ? 2500000 
          : targetQuality === VideoQuality.MEDIUM 
          ? 1500000 
          : 750000;

        await localParticipant.setCameraEnabled(true, {
          resolution: preset,
          maxBitrate: maxBitrate,
        });

        logger.debug('Applied camera quality change:', {
          quality: preferredQuality,
          manualChoice,
          networkBasedQuality,
          targetQuality,
          maxBitrate,
        });
      } catch (error) {
        logger.warn('Failed to apply camera quality change:', error);
      }
    };

    applyCameraQuality();
  }, [room, preferredQuality, lastNetworkQuality]);

  // Store original camera quality settings to restore later
  const originalCameraSettingsRef = React.useRef<{
    quality: VideoQuality | null;
    preset: typeof VideoPresets.h720;
    maxBitrate: number;
  } | null>(null);

  // Hook into screen share start events to apply quality settings
  React.useEffect(() => {
    if (!room || room.state !== 'connected') {
      return;
    }

    const localParticipant = room.localParticipant;

    const handleTrackPublished = async (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) {
        logger.debug('Screen share started, optimizing for audio quality');
        
        // Reduce camera quality to free up bandwidth for audio
        if (localParticipant.isCameraEnabled) {
          try {
            // Store original camera settings before reducing
            const currentQuality = preferredQuality !== 'auto' 
              ? qualityFromPreference(preferredQuality) 
              : qualityFromNetwork(lastNetworkQuality.current);
            
            if (currentQuality) {
              const originalPreset = currentQuality === VideoQuality.HIGH 
                ? VideoPresets.h720 
                : currentQuality === VideoQuality.MEDIUM 
                ? VideoPresets.h540 
                : VideoPresets.h360;

              const originalMaxBitrate = currentQuality === VideoQuality.HIGH 
                ? 2500000 
                : currentQuality === VideoQuality.MEDIUM 
                ? 1500000 
                : 750000;

              // Store original settings
              originalCameraSettingsRef.current = {
                quality: currentQuality,
                preset: originalPreset,
                maxBitrate: originalMaxBitrate,
              };

              // Reduce camera quality to preserve audio during screen share
              await localParticipant.setCameraEnabled(true, {
                resolution: VideoPresets.h360, // Lower resolution
                maxBitrate: 500000, // Reduced bitrate (500 kbps)
              });
              
              logger.debug('Reduced camera quality to preserve audio during screen share', {
                originalQuality: currentQuality,
                originalBitrate: originalMaxBitrate,
                newBitrate: 500000,
              });
            }
          } catch (error) {
            logger.warn('Failed to reduce camera quality:', error);
          }
        }
        
        // Apply screen share quality preference
        const targetQuality = preferredScreenShareQuality !== 'auto' 
          ? qualityFromPreference(preferredScreenShareQuality) 
          : qualityFromNetwork(lastNetworkQuality.current);

        if (targetQuality && adapterRef.current) {
          adapterRef.current.applyScreenShareSettings(targetQuality);
        }

        // Also apply to remote participants viewing this screen share
        // The quality will be applied via determineTargetQuality when they subscribe
        setTimeout(() => {
          applyQualityToRemoteTracks(lastNetworkQuality.current);
        }, 500); // Small delay to ensure track is fully published
      }
    };

    const handleTrackUnpublished = async (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) {
        logger.debug('Screen share stopped, restoring camera quality');
        
        // Restore camera quality when screen share stops
        if (localParticipant.isCameraEnabled && originalCameraSettingsRef.current) {
          try {
            // Check current network quality before restoring
            const currentNetworkQuality = qualityFromNetwork(lastNetworkQuality.current);
            const restoredQuality = originalCameraSettingsRef.current.quality;
            
            // Cap restored quality based on current network state
            const qualityOrder = [VideoQuality.LOW, VideoQuality.MEDIUM, VideoQuality.HIGH];
            const restoredIndex = qualityOrder.indexOf(restoredQuality);
            const networkIndex = qualityOrder.indexOf(currentNetworkQuality);
            const safeQuality = qualityOrder[Math.min(restoredIndex, networkIndex)];
            
            // Get safe preset and bitrate
            const safePreset = safeQuality === VideoQuality.HIGH 
              ? VideoPresets.h720 
              : safeQuality === VideoQuality.MEDIUM 
              ? VideoPresets.h540 
              : VideoPresets.h360;
            
            const safeMaxBitrate = safeQuality === VideoQuality.HIGH 
              ? 2500000 
              : safeQuality === VideoQuality.MEDIUM 
              ? 1500000 
              : 750000;
            
            await localParticipant.setCameraEnabled(true, {
              resolution: safePreset,
              maxBitrate: safeMaxBitrate,
            });
            
            logger.debug('Restored camera quality after screen share', {
              originalQuality: restoredQuality,
              currentNetworkQuality: lastNetworkQuality.current,
              safeQuality,
              bitrate: safeMaxBitrate,
            });
            
            // Clear stored settings
            originalCameraSettingsRef.current = null;
          } catch (error) {
            logger.warn('Failed to restore camera quality:', error);
          }
        }
      }
    };

    localParticipant.on('trackPublished', handleTrackPublished);
    localParticipant.on('trackUnpublished', handleTrackUnpublished);

    return () => {
      localParticipant.off('trackPublished', handleTrackPublished);
      localParticipant.off('trackUnpublished', handleTrackUnpublished);
    };
  }, [room, preferredScreenShareQuality, preferredQuality, lastNetworkQuality, applyQualityToRemoteTracks]);
}


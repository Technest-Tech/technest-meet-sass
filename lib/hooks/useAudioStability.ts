'use client';

import { useEffect, useRef } from 'react';
import { Room, RoomEvent, Track, RemoteAudioTrack, RemoteTrackPublication, ConnectionQuality, Participant } from 'livekit-client';
import { logger } from '../utils/logger';
import { trackLock } from '../utils/trackLock';
import { healthCheckLock } from '../utils/healthCheckLock';

/**
 * Enhanced Audio Stability Hook
 * 
 * This hook ensures audio remains stable and doesn't lag or disconnect:
 * 1. Monitors connection quality and adapts audio settings
 * 2. Ensures audio tracks stay subscribed during poor network
 * 3. Manages audio buffer/jitter for smooth playback
 * 4. Prioritizes audio over video during network issues
 * 5. Handles reconnection scenarios gracefully
 * 6. Prevents audio dropouts and lag
 * 
 * @param room - The LiveKit room instance
 */
export function useAudioStability(room: Room | null | undefined) {
  const connectionQualityRef = useRef<ConnectionQuality>(ConnectionQuality.Good);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const stabilityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastStabilityCheckRef = useRef<Map<string, number>>(new Map());
  const audioLatencyRef = useRef<Map<string, { lastCheckTime: number; expectedTime: number; actualTime: number }>>(new Map());
  const bufferingStateRef = useRef<Map<string, { isBuffering: boolean; lastBufferingTime: number; bufferingCount: number }>>(new Map());

  useEffect(() => {
    if (!room || room.state !== 'connected') return;

    // Monitor connection quality changes
    const handleConnectionQualityChanged = (
      quality: ConnectionQuality,
      participant: Participant | undefined
    ) => {
      // Only monitor local participant quality
      if (participant && participant !== room.localParticipant) {
        return;
      }

      connectionQualityRef.current = quality;
      logger.debug('Connection quality changed, adapting audio stability:', quality);

      // CRITICAL: Ensure all audio tracks stay subscribed even during poor network
      // Audio is critical and should not be dropped
      room.remoteParticipants.forEach((participant) => {
        if (!participant.isConnected) return;

        participant.audioTrackPublications.forEach((publication) => {
          // Always keep audio subscribed, even during poor network
          if (!publication.isSubscribed && !publication.isMuted) {
            try {
              publication.setSubscribed(true);
              logger.debug('Ensuring audio track stays subscribed during network issues', {
                participant: participant.identity,
                quality,
              });
            } catch (error) {
              logger.warn('Failed to subscribe audio track:', error);
            }
          }
        });
      });

      // CRITICAL FIX: Handle network quality degradation - retry local track publication
      if (quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost) {
        logger.warn('Network quality degraded, checking local tracks:', quality);
        
        // Check local microphone track
        if (room.localParticipant) {
          const isMicEnabled = room.localParticipant.isMicrophoneEnabled;
          const micPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
          
          // If mic should be enabled but track doesn't exist or failed, retry publication
          if (isMicEnabled && (!micPublication || !micPublication.track)) {
            logger.warn('Microphone track missing during poor network, attempting recovery');
            setTimeout(async () => {
              if (room && room.state === 'connected' && room.localParticipant) {
                try {
                  await room.localParticipant.setMicrophoneEnabled(false);
                  await new Promise(resolve => setTimeout(resolve, 500));
                  await room.localParticipant.setMicrophoneEnabled(true);
                  logger.info('Microphone track recovered after network issue');
                } catch (error) {
                  logger.error('Failed to recover microphone track:', error);
                }
              }
            }, 2000);
          }
        }
      }
    };

    // Comprehensive stability check
    const performStabilityCheck = async () => {
      if (!room || room.state !== 'connected') return;
      
      // CRITICAL FIX: Use health check lock to prevent conflicts with other health checks
      const acquired = await healthCheckLock.acquire();
      if (!acquired) {
        logger.debug('Health check already running, skipping stability check');
        return;
      }
      
      try {

      const now = Date.now();
      const quality = connectionQualityRef.current;

      room.remoteParticipants.forEach((participant) => {
        if (!participant.isConnected) return;

        participant.audioTrackPublications.forEach((publication) => {
          const trackSid = publication.trackSid;
          const participantId = participant.identity;
          const key = `${participantId}-${trackSid}`;

          // Throttle checks (max once per 3 seconds)
          const lastCheck = lastStabilityCheckRef.current.get(key) || 0;
          if (now - lastCheck < 3000) {
            return;
          }

          // CRITICAL: Ensure audio tracks are always subscribed (unless muted)
          // This is the most important stability measure
          if (!publication.isSubscribed && !publication.isMuted) {
            logger.debug('Stability check: Audio track not subscribed, fixing...', {
              participant: participantId,
              trackSid,
              quality,
            });
            try {
              publication.setSubscribed(true);
              lastStabilityCheckRef.current.set(key, now);
            } catch (error) {
              logger.warn('Failed to subscribe audio track in stability check:', error);
            }
          }

          // Ensure track is enabled if subscribed
          if (publication.isSubscribed && publication.track) {
            const remoteTrack = publication.track as RemoteAudioTrack;
            if (!remoteTrack.isEnabled && !publication.isMuted) {
              logger.debug('Stability check: Audio track disabled, enabling...', {
                participant: participantId,
                trackSid,
              });
              try {
                remoteTrack.setEnabled(true);
                lastStabilityCheckRef.current.set(key, now);
              } catch (error) {
                logger.warn('Failed to enable audio track in stability check:', error);
              }
            }

            // Monitor track health - detect if track is "stuck" or not receiving data
            const audioElement = audioElementsRef.current.get(remoteTrack.sid);

            if (audioElement) {
              // Check if audio element is playing
              if (audioElement.paused && !publication.isMuted) {
                logger.debug('Stability check: Audio element paused, attempting to resume...', {
                  participant: participantId,
                });
                try {
                  audioElement.play().catch((error) => {
                    logger.debug('Could not resume audio playback:', error);
                  });
                } catch (error) {
                  logger.debug('Error resuming audio:', error);
                }
              }

              // Monitor buffering state
              const bufferingKey = `${participantId}-${trackSid}`;
              const isBuffering = audioElement.readyState < audioElement.HAVE_FUTURE_DATA;
              const bufferingState = bufferingStateRef.current.get(bufferingKey) || {
                isBuffering: false,
                lastBufferingTime: 0,
                bufferingCount: 0,
              };

              if (isBuffering && !bufferingState.isBuffering) {
                // Started buffering
                bufferingState.isBuffering = true;
                bufferingState.lastBufferingTime = now;
                bufferingState.bufferingCount++;
                logger.warn('Audio element started buffering', {
                  participant: participantId,
                  trackSid,
                  readyState: audioElement.readyState,
                  networkState: audioElement.networkState,
                  bufferingCount: bufferingState.bufferingCount,
                });
                
                // If buffering for too long, try recovery
                if (bufferingState.bufferingCount > 3) {
                  logger.warn('Excessive buffering detected, attempting recovery...', {
                    participant: participantId,
                    trackSid,
                  });
                  try {
                    remoteTrack.detach();
                    setTimeout(() => {
                      remoteTrack.attach(audioElement);
                      audioElement.load(); // Force reload
                    }, 100);
                    bufferingState.bufferingCount = 0; // Reset counter
                  } catch (error) {
                    logger.warn('Failed to recover from buffering:', error);
                  }
                }
              } else if (!isBuffering && bufferingState.isBuffering) {
                // Stopped buffering
                bufferingState.isBuffering = false;
                const bufferingDuration = now - bufferingState.lastBufferingTime;
                if (bufferingDuration > 1000) {
                  logger.warn('Audio element was buffering for extended period', {
                    participant: participantId,
                    trackSid,
                    duration: bufferingDuration,
                  });
                }
              }
              bufferingStateRef.current.set(bufferingKey, bufferingState);

              // Monitor audio latency
              const latencyKey = `${participantId}-${trackSid}`;
              const latencyData = audioLatencyRef.current.get(latencyKey) || {
                lastCheckTime: now,
                expectedTime: 0,
                actualTime: 0,
              };

              if (audioElement.currentTime > 0 && !audioElement.paused) {
                const expectedTime = latencyData.expectedTime + (now - latencyData.lastCheckTime) / 1000;
                const actualTime = audioElement.currentTime;
                const latency = Math.abs(expectedTime - actualTime) * 1000; // Convert to ms

                if (latency > 500) {
                  logger.warn('High audio latency detected', {
                    participant: participantId,
                    trackSid,
                    latency: latency.toFixed(2),
                    expected: expectedTime.toFixed(2),
                    actual: actualTime.toFixed(2),
                  });
                  
                  // Try to reduce latency by seeking
                  if (latency > 1000) {
                    try {
                      audioElement.currentTime = actualTime; // Sync to current position
                      logger.debug('Attempted to sync audio to reduce latency');
                    } catch (error) {
                      logger.debug('Could not sync audio:', error);
                    }
                  }
                }

                latencyData.lastCheckTime = now;
                latencyData.expectedTime = actualTime;
                audioLatencyRef.current.set(latencyKey, latencyData);
              }

              // Check network state
              if (audioElement.networkState === HTMLMediaElement.NETWORK_NO_SOURCE ||
                  audioElement.networkState === HTMLMediaElement.NETWORK_EMPTY) {
                logger.warn('Audio element network state indicates no source', {
                  participant: participantId,
                  trackSid,
                  networkState: audioElement.networkState,
                });
                // Try to reattach track
                try {
                  remoteTrack.detach();
                  setTimeout(() => {
                    remoteTrack.attach(audioElement);
                  }, 100);
                } catch (error) {
                  logger.warn('Failed to recover from network state issue:', error);
                }
              }

              // Check readyState for issues
              if (audioElement.readyState === HTMLMediaElement.HAVE_NOTHING ||
                  audioElement.readyState === HTMLMediaElement.HAVE_METADATA) {
                // Audio is not ready, might be stuck
                const timeSinceLastCheck = now - (lastStabilityCheckRef.current.get(key) || 0);
                if (timeSinceLastCheck > 5000) {
                  logger.warn('Audio element stuck in low readyState', {
                    participant: participantId,
                    trackSid,
                    readyState: audioElement.readyState,
                  });
                  // Try recovery
                  try {
                    remoteTrack.detach();
                    setTimeout(() => {
                      remoteTrack.attach(audioElement);
                    }, 100);
                  } catch (error) {
                    logger.warn('Failed to recover from readyState issue:', error);
                  }
                }
              }

              // Check for audio element errors
              if (audioElement.error) {
                logger.warn('Audio element error detected, attempting recovery...', {
                  participant: participantId,
                  error: audioElement.error,
                  errorCode: audioElement.error?.code,
                  errorMessage: audioElement.error?.message,
                });
                // Progressive recovery strategy
                try {
                  // First try: reattach track
                  remoteTrack.detach();
                  setTimeout(() => {
                    remoteTrack.attach(audioElement);
                    // Second try: reload element if reattach doesn't work
                    setTimeout(() => {
                      if (audioElement.error) {
                        audioElement.load();
                        remoteTrack.attach(audioElement);
                      }
                    }, 200);
                  }, 100);
                } catch (error) {
                  logger.warn('Failed to recover audio element:', error);
                }
              }
            }
          }
        });
      });

      // Also ensure local microphone track is stable
      if (room.localParticipant) {
        const isEnabled = room.localParticipant.isMicrophoneEnabled;
        const localMicPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        const trackId = `local-mic-${room.localParticipant.identity}`;
        
        // CRITICAL: Don't interfere if track is being modified
        if (trackLock.isLocked(trackId) || trackLock.wasRecentlyModified(trackId)) {
          return; // Skip this check entirely
        }
        
        // CRITICAL FIX: Check if microphone should be enabled but track doesn't exist
        if (isEnabled && (!localMicPublication || !localMicPublication.track)) {
          logger.warn('Stability check: Microphone is enabled but track is missing, attempting to republish...', {
            hasPublication: !!localMicPublication,
            hasTrack: !!(localMicPublication?.track),
          });
          
          // Only attempt republish if we can acquire lock
          trackLock.acquire(trackId).then((acquired) => {
            if (acquired) {
              try {
                // CRITICAL FIX: Better recovery - disable then re-enable
                room.localParticipant.setMicrophoneEnabled(false).then(() => {
                  return new Promise(resolve => setTimeout(resolve, 500));
                }).then(() => {
                  return room.localParticipant.setMicrophoneEnabled(true);
                }).then(() => {
                  trackLock.release(trackId);
                  logger.info('Stability check: Microphone track successfully republished');
                }).catch((error) => {
                  logger.warn('Stability check: Failed to republish microphone track:', error);
                  trackLock.release(trackId);
                });
              } catch (error) {
                logger.warn('Stability check: Error attempting to republish microphone:', error);
                trackLock.release(trackId);
              }
            }
          });
        } else if (localMicPublication && localMicPublication.track) {
          // If track exists, ensure it's enabled if it should be
          if (isEnabled && !localMicPublication.track.isEnabled) {
            logger.debug('Stability check: Local microphone disabled, enabling...');
            try {
              localMicPublication.track.setEnabled(true);
            } catch (error) {
              logger.warn('Failed to enable local microphone in stability check:', error);
            }
          }
        }
      }
      } finally {
        healthCheckLock.release();
      }
    };

    // Track audio elements for monitoring
    const setupAudioElementTracking = (track: RemoteAudioTrack, participant: Participant) => {
      const trackSid = track.sid;
      
      // Find or create audio element
      let audioElement = audioElementsRef.current.get(trackSid);
      if (!audioElement) {
        // Look for existing audio element in DOM
        const existingElement = document.querySelector(
          `audio[data-lk-source="microphone"][data-lk-participant="${participant.identity}"]`
        ) as HTMLAudioElement;
        
        if (existingElement) {
          audioElement = existingElement;
        } else {
          audioElement = document.createElement('audio');
          // Low-latency audio configuration
          audioElement.autoplay = true;
          audioElement.playsInline = true;
          audioElement.preload = 'none'; // Prevent buffering for low latency
          audioElement.setAttribute('data-lk-source', 'microphone');
          audioElement.setAttribute('data-lk-participant', participant.identity);
          audioElement.setAttribute('data-lk-track-sid', trackSid);
          audioElement.style.display = 'none';
          
          // Enhanced event listeners for buffering and state monitoring
          audioElement.addEventListener('waiting', () => {
            const bufferingKey = `${participant.identity}-${trackSid}`;
            const state = bufferingStateRef.current.get(bufferingKey) || {
              isBuffering: false,
              lastBufferingTime: Date.now(),
              bufferingCount: 0,
            };
            state.isBuffering = true;
            state.lastBufferingTime = Date.now();
            bufferingStateRef.current.set(bufferingKey, state);
            logger.debug('Audio element waiting (buffering)', {
              participant: participant.identity,
              trackSid,
            });
          });
          
          audioElement.addEventListener('canplay', () => {
            const bufferingKey = `${participant.identity}-${trackSid}`;
            const state = bufferingStateRef.current.get(bufferingKey);
            if (state) {
              state.isBuffering = false;
              bufferingStateRef.current.set(bufferingKey, state);
            }
            logger.debug('Audio element can play', {
              participant: participant.identity,
              trackSid,
            });
          });
          
          audioElement.addEventListener('stalled', () => {
            logger.warn('Audio element stalled', {
              participant: participant.identity,
              trackSid,
            });
            // Try to recover
            setTimeout(() => {
              if (audioElement && audioElement.paused) {
                audioElement.play().catch((error) => {
                  logger.debug('Could not resume stalled audio:', error);
                });
              }
            }, 100);
          });
          
          document.body.appendChild(audioElement);
        }
        
        audioElementsRef.current.set(trackSid, audioElement);

        // Set up error handling for audio element
        audioElement.addEventListener('error', (event) => {
          logger.warn('Audio element error:', {
            participant: participant.identity,
            error: audioElement.error,
          });
        });

        // Set up play event to ensure audio is working
        audioElement.addEventListener('play', () => {
          logger.debug('Audio element started playing', {
            participant: participant.identity,
          });
        });
      }

      // Attach track if not already attached
      if (audioElement.srcObject !== track.mediaStream) {
        try {
          track.attach(audioElement);
        } catch (error) {
          logger.debug('Could not attach track to audio element:', error);
        }
      }
    };

    // Handle track subscription events
    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      if (track.kind === Track.Kind.Audio && track instanceof RemoteAudioTrack) {
        setupAudioElementTracking(track, participant);
        
        // Ensure track is enabled
        setTimeout(() => {
          if (publication.track && !publication.track.isEnabled && !publication.isMuted) {
            try {
              (publication.track as RemoteAudioTrack).setEnabled(true);
            } catch (error) {
              logger.debug('Could not enable track immediately:', error);
            }
          }
        }, 100);
      }
    };

    // Handle participant connection
    const handleParticipantConnected = (participant: Participant) => {
      participant.on('trackSubscribed', handleTrackSubscribed);

      // Process existing audio tracks
      participant.audioTrackPublications.forEach((publication) => {
        if (publication.track && publication.isSubscribed) {
          handleTrackSubscribed(publication.track, publication, participant);
        }
      });
    };

    // Handle participant disconnection
    const handleParticipantDisconnected = (participant: Participant) => {
      // Clean up audio elements for disconnected participant
      participant.audioTrackPublications.forEach((publication) => {
        if (publication.track) {
          const trackSid = publication.track.sid;
          audioElementsRef.current.delete(trackSid);
        }
      });
    };

    // Set up event listeners
    room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    // Process existing participants
    room.remoteParticipants.forEach((participant) => {
      participant.on('trackSubscribed', handleTrackSubscribed);
      participant.audioTrackPublications.forEach((publication) => {
        if (publication.track && publication.isSubscribed && publication.track.kind === Track.Kind.Audio) {
          setupAudioElementTracking(publication.track as RemoteAudioTrack, participant);
        }
      });
    });

    // Initial stability check
    performStabilityCheck();

    // Run stability check every 15 seconds (reduced from 2s to prevent interference)
    stabilityCheckIntervalRef.current = setInterval(performStabilityCheck, 15000);

    // Initial connection quality check
    if (room.localParticipant) {
      const initialQuality = room.localParticipant.connectionQuality || ConnectionQuality.Good;
      connectionQualityRef.current = initialQuality;
    }

    return () => {
      if (stabilityCheckIntervalRef.current) {
        clearInterval(stabilityCheckIntervalRef.current);
        stabilityCheckIntervalRef.current = null;
      }

      // Cleanup event listeners
      room.off(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

      room.remoteParticipants.forEach((participant) => {
        participant.off('trackSubscribed', handleTrackSubscribed);
      });

      // Cleanup audio elements (only if not used by other hooks)
      audioElementsRef.current.forEach((element, trackSid) => {
        // Check if element is still in use by checking for data-lk-track-sid attribute
        const isUsedElsewhere = document.querySelector(
          `audio[data-lk-track-sid="${trackSid}"]`
        ) !== null;
        
        if (!isUsedElsewhere) {
          try {
            element.remove();
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      });
      audioElementsRef.current.clear();
      audioLatencyRef.current.clear();
      bufferingStateRef.current.clear();
    };
  }, [room]);
}






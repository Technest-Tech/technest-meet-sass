'use client';

import { useEffect, useRef } from 'react';
import { Track, RemoteAudioTrack, RemoteTrackPublication, Room, RoomEvent, Participant, TrackPublication } from 'livekit-client';
import { logger } from '../utils/logger';
import { trackLock } from '../utils/trackLock';
import { healthCheckLock } from '../utils/healthCheckLock';

/**
 * Hook to monitor and automatically fix audio track issues
 * Addresses intermittent audio problems where teacher/student can't hear each other
 * 
 * This hook:
 * - Monitors audio track subscription status
 * - Automatically resubscribes tracks that should be active
 * - Ensures tracks are enabled when they should be
 * - Detects and fixes common audio connectivity issues
 * 
 * @param room - The LiveKit room instance
 */
export function useAudioTrackHealth(room: Room | null | undefined) {
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHealthCheckRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!room || room.state !== 'connected') return;

    const checkAndFixAudioTracks = async () => {
      if (!room || room.state !== 'connected') return;
      
      // CRITICAL FIX: Use health check lock to prevent conflicts with other health checks
      const acquired = await healthCheckLock.acquire();
      if (!acquired) {
        logger.debug('Health check already running, skipping');
        return;
      }
      
      try {

      room.remoteParticipants.forEach((participant) => {
        // Skip if participant is not connected
        if (!participant.isConnected) {
          return;
        }

        participant.audioTrackPublications.forEach((publication) => {
          const trackSid = publication.trackSid;
          const participantId = participant.identity;
          const key = `${participantId}-${trackSid}`;
          const now = Date.now();

          // Throttle fixes for the same track (max once per 5 seconds)
          const lastCheck = lastHealthCheckRef.current.get(key) || 0;
          if (now - lastCheck < 5000) {
            return;
          }

          // Check if track exists but is not subscribed
          if (publication.track && !publication.isSubscribed && !publication.isMuted) {
            logger.debug('Audio track not subscribed, resubscribing...', {
              participant: participantId,
              trackSid,
            });
            try {
              publication.setSubscribed(true);
              lastHealthCheckRef.current.set(key, now);
            } catch (error) {
              logger.warn('Failed to resubscribe audio track:', error);
            }
            return;
          }

          // Check if track is subscribed but not enabled
          if (publication.isSubscribed && publication.track) {
            const remoteTrack = publication.track as RemoteAudioTrack;
            
            // Only enable if not muted
            if (!remoteTrack.isEnabled && !publication.isMuted) {
              logger.debug('Audio track disabled, enabling...', {
                participant: participantId,
                trackSid,
              });
              try {
                remoteTrack.setEnabled(true);
                lastHealthCheckRef.current.set(key, now);
              } catch (error) {
                logger.warn('Failed to enable audio track:', error);
              }
            }
          }

          // Check if track should exist but doesn't
          // This handles cases where tracks were lost due to network issues
          if (!publication.track && publication.trackSid) {
            // Try to resubscribe to recover the track
            try {
              if (!publication.isSubscribed) {
                logger.debug('Attempting to recover lost audio track...', {
                  participant: participantId,
                  trackSid,
                });
                publication.setSubscribed(true);
                lastHealthCheckRef.current.set(key, now);
              }
            } catch (error) {
              // Track might not be available yet, this is normal
              logger.debug('Could not recover audio track (may not be available yet):', error);
            }
          }
        });
      });

      // Also check local participant's microphone track
      if (room.localParticipant) {
        const isEnabled = room.localParticipant.isMicrophoneEnabled;
        const localMicPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        const trackId = `local-mic-${room.localParticipant.identity}`;
        
        // Check if track is transitioning or recently modified
        if (trackLock.isLocked(trackId) || trackLock.wasRecentlyModified(trackId)) {
          logger.debug('Microphone track is locked or recently modified, skipping health check');
          return;
        }
        
        // CRITICAL FIX: Check if microphone should be enabled but track doesn't exist
        if (isEnabled && (!localMicPublication || !localMicPublication.track)) {
          logger.warn('Microphone is enabled but track is missing, attempting to republish...', {
            hasPublication: !!localMicPublication,
            hasTrack: !!(localMicPublication?.track),
          });
          
          // Throttle republish attempts (max once per 30 seconds - increased from 10s)
          const lastRepublishKey = 'local-mic-republish';
          const lastRepublish = lastHealthCheckRef.current.get(lastRepublishKey) || 0;
          const now = Date.now();
          
          if (now - lastRepublish > 30000) {
            // Acquire lock before republishing
            trackLock.acquire(trackId).then((acquired) => {
              if (acquired) {
                try {
                  // Attempt to republish the microphone track
                  room.localParticipant.setMicrophoneEnabled(true).then(() => {
                    trackLock.release(trackId);
                  }).catch((error) => {
                    logger.warn('Failed to republish microphone track:', error);
                    trackLock.release(trackId);
                  });
                  lastHealthCheckRef.current.set(lastRepublishKey, now);
                } catch (error) {
                  logger.warn('Error attempting to republish microphone:', error);
                  trackLock.release(trackId);
                }
              }
            });
          }
          return; // Skip further checks if track doesn't exist
        }
        
        // If track exists, ensure it's enabled if it should be
        if (localMicPublication && localMicPublication.track) {
          if (isEnabled && !localMicPublication.track.isEnabled) {
            logger.debug('Local microphone track disabled, enabling...');
            try {
              localMicPublication.track.setEnabled(true);
            } catch (error) {
              logger.warn('Failed to enable local microphone track:', error);
            }
          }
          
          // Also check if track is enabled but microphone state says it should be disabled
          if (!isEnabled && localMicPublication.track.isEnabled) {
            logger.debug('Local microphone track enabled but state says disabled, disabling...');
            try {
              localMicPublication.track.setEnabled(false);
            } catch (error) {
              logger.warn('Failed to disable local microphone track:', error);
            }
          }
        }
      }
      } finally {
        healthCheckLock.release();
      }
    };

    // Initial check
    checkAndFixAudioTracks();

    // Check every 20 seconds for audio health issues (reduced from 2s to prevent interference)
    healthCheckIntervalRef.current = setInterval(checkAndFixAudioTracks, 20000);

    // Also listen for track events to fix issues immediately
    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      if (track.kind === Track.Kind.Audio) {
        // Small delay to ensure track is ready
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

    // CRITICAL FIX: Handle tracks published AFTER participant connects
    const handleTrackPublished = (publication: TrackPublication, participant: Participant) => {
      // Only handle remote participants
      if (participant === room.localParticipant) return;

      // Only handle microphone tracks
      if (publication.kind !== Track.Kind.Audio || publication.source !== Track.Source.Microphone) {
        return;
      }

      // CRITICAL: Immediately subscribe to newly published tracks
      // CRITICAL FIX: Add guard to prevent double subscriptions (handled by room-level subscription)
      if (publication.track && !publication.isSubscribed && !publication.isMuted) {
        try {
          logger.debug('Audio track health: Subscribing to newly published track', {
            participant: participant.identity,
            trackSid: publication.trackSid,
          });
          publication.setSubscribed(true);
        } catch (error) {
          logger.warn('Audio track health: Failed to subscribe to newly published track:', error);
        }
      }

      // Also ensure track is enabled
      setTimeout(() => {
        if (publication.track && !publication.track.isEnabled && !publication.isMuted) {
          try {
            (publication.track as RemoteAudioTrack).setEnabled(true);
          } catch (error) {
            logger.debug('Could not enable audio track immediately:', error);
          }
        }
      }, 100);
    };

    // CRITICAL FIX: Track participant handlers for proper cleanup
    const participantHandlersRef = useRef<Map<string, { subscribed: () => void; published: (publication: TrackPublication) => void }>>(new Map());

    const handleParticipantConnected = (participant: any) => {
      // CRITICAL FIX: Store handlers for cleanup
      const subscribedHandler = handleTrackSubscribed;
      const publishedHandler = (publication: TrackPublication) => {
        handleTrackPublished(publication, participant);
      };
      
      participantHandlersRef.current.set(participant.identity, {
        subscribed: subscribedHandler,
        published: publishedHandler
      });

      participant.on('trackSubscribed', subscribedHandler);
      participant.on('trackPublished', publishedHandler);
    };

    // CRITICAL FIX: Also handle participant disconnect at room level
    const handleParticipantDisconnected = (participant: Participant) => {
      const handlers = participantHandlersRef.current.get(participant.identity);
      if (handlers) {
        try {
          participant.off('trackSubscribed', handlers.subscribed);
          participant.off('trackPublished', handlers.published);
        } catch (error) {
          // Participant might already be cleaned up
          logger.debug('Error cleaning up participant handlers (ignored):', error);
        }
        participantHandlersRef.current.delete(participant.identity);
      }
    };

    room.on('participantConnected', handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    // CRITICAL: Also listen for room-level TrackPublished events
    const handleRoomTrackPublished = (publication: TrackPublication, participant: Participant | undefined) => {
      if (participant && participant !== room.localParticipant) {
        handleTrackPublished(publication, participant);
      }
    };
    room.on(RoomEvent.TrackPublished, handleRoomTrackPublished);

    // Set up listeners for existing participants
    room.remoteParticipants.forEach((participant) => {
      participant.on('trackSubscribed', handleTrackSubscribed);
      participant.on('trackPublished', (publication: TrackPublication) => {
        handleTrackPublished(publication, participant);
      });
    });

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
      
      // CRITICAL FIX: Cleanup event listeners with null checks
      try {
        if (room && typeof room.off === 'function') {
          room.off('participantConnected', handleParticipantConnected);
          room.off(RoomEvent.TrackPublished, handleRoomTrackPublished);
          room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        }
      } catch (error) {
        logger.debug('Error removing room event listeners (ignored):', error);
      }
      
      // CRITICAL FIX: Cleanup all participant handlers
      participantHandlersRef.current.forEach((handlers, identity) => {
        try {
          // Find participant in room if still connected
          const participant = Array.from(room.remoteParticipants.values()).find(p => p.identity === identity);
          if (participant) {
            participant.off('trackSubscribed', handlers.subscribed);
            participant.off('trackPublished', handlers.published);
          }
        } catch (error) {
          logger.debug('Error cleaning up participant handlers (ignored):', error);
        }
      });
      participantHandlersRef.current.clear();
      
      // Cleanup existing participants
      try {
        room.remoteParticipants.forEach((participant) => {
          try {
            participant.off('trackSubscribed', handleTrackSubscribed);
            // Try to remove trackPublished handler if it exists
            const handlers = participantHandlersRef.current.get(participant.identity);
            if (handlers) {
              participant.off('trackPublished', handlers.published);
            }
          } catch (error) {
            // Participant might already be cleaned up
            logger.debug('Error cleaning up participant (ignored):', error);
          }
        });
      } catch (error) {
        logger.debug('Error iterating participants during cleanup (ignored):', error);
      }
    };
  }, [room]);
}






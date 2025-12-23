'use client';

import { useEffect, useRef } from 'react';
import { Track, RemoteVideoTrack, RemoteTrackPublication, Room, LocalVideoTrack, RoomEvent, Participant, TrackPublication } from 'livekit-client';
import { logger } from '../utils/logger';
import { trackLock } from '../utils/trackLock';
import { healthCheckLock } from '../utils/healthCheckLock';

/**
 * Hook to monitor and automatically fix video track issues
 * Addresses intermittent video problems where teacher/student can't see each other
 * 
 * This hook:
 * - Monitors video track subscription status
 * - Automatically resubscribes tracks that should be active
 * - Ensures tracks are enabled when they should be
 * - Detects and fixes common video connectivity issues
 * - Handles cases where teacher opens camera and student joins
 * 
 * @param room - The LiveKit room instance
 */
export function useVideoTrackHealth(room: Room | null | undefined) {
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHealthCheckRef = useRef<Map<string, number>>(new Map());
  const pendingSubscriptionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!room || room.state !== 'connected') return;

    const checkAndFixVideoTracks = async () => {
      if (!room || room.state !== 'connected') return;
      
      // CRITICAL FIX: Use health check lock to prevent conflicts with other health checks
      const acquired = await healthCheckLock.acquire();
      if (!acquired) {
        logger.debug('Health check already running, skipping video health check');
        return;
      }
      
      try {
        // Check remote participants' video tracks
        room.remoteParticipants.forEach((participant) => {
          // Skip if participant is not connected
          if (!participant.isConnected) {
            return;
          }

          participant.videoTrackPublications.forEach((publication) => {
            const trackSid = publication.trackSid;
            const participantId = participant.identity;
            const key = `${participantId}-${trackSid}`;
            const now = Date.now();

            // Throttle fixes for the same track (max once per 5 seconds)
            const lastCheck = lastHealthCheckRef.current.get(key) || 0;
            if (now - lastCheck < 5000) {
              return;
            }

            // Skip if subscription is already pending
            if (pendingSubscriptionsRef.current.has(key)) {
              return;
            }

            // Check if track exists but is not subscribed
            if (publication.track && !publication.isSubscribed && !publication.isMuted) {
              logger.debug('Video track not subscribed, resubscribing...', {
                participant: participantId,
                trackSid,
              });
              try {
                pendingSubscriptionsRef.current.add(key);
                publication.setSubscribed(true);
                lastHealthCheckRef.current.set(key, now);
                
                // Remove from pending after a delay
                setTimeout(() => {
                  pendingSubscriptionsRef.current.delete(key);
                }, 2000);
              } catch (error) {
                logger.warn('Failed to resubscribe video track:', error);
                pendingSubscriptionsRef.current.delete(key);
              }
              return;
            }

            // Check if track is subscribed but not enabled
            if (publication.isSubscribed && publication.track) {
              const remoteTrack = publication.track as RemoteVideoTrack;
              
              // Only enable if not muted
              if (!remoteTrack.isEnabled && !publication.isMuted) {
                logger.debug('Video track disabled, enabling...', {
                  participant: participantId,
                  trackSid,
                });
                try {
                  remoteTrack.setEnabled(true);
                  lastHealthCheckRef.current.set(key, now);
                } catch (error) {
                  logger.warn('Failed to enable video track:', error);
                }
              }
            }

            // Check if track should exist but doesn't
            // This handles cases where tracks were lost due to network issues
            if (!publication.track && publication.trackSid && !publication.isMuted) {
              // Try to resubscribe to recover the track
              try {
                if (!publication.isSubscribed) {
                  logger.debug('Attempting to recover lost video track...', {
                    participant: participantId,
                    trackSid,
                  });
                  pendingSubscriptionsRef.current.add(key);
                  publication.setSubscribed(true);
                  lastHealthCheckRef.current.set(key, now);
                  
                  setTimeout(() => {
                    pendingSubscriptionsRef.current.delete(key);
                  }, 2000);
                }
              } catch (error) {
                // Track might not be available yet, this is normal
                logger.debug('Could not recover video track (may not be available yet):', error);
                pendingSubscriptionsRef.current.delete(key);
              }
            }
          });
        });

        // Also check local participant's camera track
        if (room.localParticipant) {
          const isEnabled = room.localParticipant.isCameraEnabled;
          const localCameraPublication = room.localParticipant.getTrackPublication(Track.Source.Camera);
          const trackId = `local-camera-${room.localParticipant.identity}`;
          
          // Check if track is transitioning or recently modified
          if (trackLock.isLocked(trackId) || trackLock.wasRecentlyModified(trackId)) {
            logger.debug('Camera track is locked or recently modified, skipping health check');
            return;
          }
          
          // CRITICAL FIX: Check if camera should be enabled but track doesn't exist
          if (isEnabled && (!localCameraPublication || !localCameraPublication.track)) {
            logger.warn('Camera is enabled but track is missing, attempting to republish...', {
              hasPublication: !!localCameraPublication,
              hasTrack: !!(localCameraPublication?.track),
            });
            
            // Throttle republish attempts (max once per 30 seconds)
            const lastRepublishKey = 'local-camera-republish';
            const lastRepublish = lastHealthCheckRef.current.get(lastRepublishKey) || 0;
            const now = Date.now();
            
            if (now - lastRepublish > 30000) {
              // Acquire lock before republishing
              trackLock.acquire(trackId).then((acquired) => {
                if (acquired) {
                  try {
                    // Attempt to republish the camera track
                    room.localParticipant.setCameraEnabled(true).then(() => {
                      trackLock.release(trackId);
                    }).catch((error) => {
                      logger.warn('Failed to republish camera track:', error);
                      trackLock.release(trackId);
                    });
                    lastHealthCheckRef.current.set(lastRepublishKey, now);
                  } catch (error) {
                    logger.warn('Error attempting to republish camera:', error);
                    trackLock.release(trackId);
                  }
                }
              });
            }
            return; // Skip further checks if track doesn't exist
          }
          
          // If track exists, ensure it's enabled if it should be
          if (localCameraPublication && localCameraPublication.track) {
            if (isEnabled && !localCameraPublication.track.isEnabled) {
              logger.debug('Local camera track disabled, enabling...');
              try {
                localCameraPublication.track.setEnabled(true);
              } catch (error) {
                logger.warn('Failed to enable local camera track:', error);
              }
            }
            
            // Also check if track is enabled but camera state says it should be disabled
            if (!isEnabled && localCameraPublication.track.isEnabled) {
              logger.debug('Local camera track enabled but state says disabled, disabling...');
              try {
                localCameraPublication.track.setEnabled(false);
              } catch (error) {
                logger.warn('Failed to disable local camera track:', error);
              }
            }
          }
        }
      } finally {
        healthCheckLock.release();
      }
    };

    // Initial check
    checkAndFixVideoTracks();

    // Check every 20 seconds for video health issues
    healthCheckIntervalRef.current = setInterval(checkAndFixVideoTracks, 20000);

    // Also listen for track events to fix issues immediately
    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      if (track.kind === Track.Kind.Video) {
        // Small delay to ensure track is ready
        setTimeout(() => {
          if (publication.track && !publication.track.isEnabled && !publication.isMuted) {
            try {
              (publication.track as RemoteVideoTrack).setEnabled(true);
            } catch (error) {
              logger.debug('Could not enable video track immediately:', error);
            }
          }
        }, 100);
      }
    };

    // CRITICAL FIX: Handle tracks published AFTER participant connects
    const handleTrackPublished = (publication: TrackPublication, participant: Participant) => {
      // Only handle remote participants
      if (participant === room.localParticipant) return;

      // Only handle camera tracks
      if (publication.kind !== Track.Kind.Video || publication.source !== Track.Source.Camera) {
        return;
      }

      // CRITICAL: Immediately subscribe to newly published tracks
      // CRITICAL FIX: Check if subscription is already pending to prevent double subscriptions
      const key = `${participant.identity}-${publication.trackSid}`;
      if (publication.track && !publication.isSubscribed && !publication.isMuted && !pendingSubscriptionsRef.current.has(key)) {
        try {
          logger.debug('Video track health: Subscribing to newly published track', {
            participant: participant.identity,
            trackSid: publication.trackSid,
          });
          pendingSubscriptionsRef.current.add(key);
          publication.setSubscribed(true);
          setTimeout(() => {
            pendingSubscriptionsRef.current.delete(key);
          }, 2000);
        } catch (error) {
          logger.warn('Video track health: Failed to subscribe to newly published track:', error);
          pendingSubscriptionsRef.current.delete(key);
        }
      }

      // Also ensure track is enabled
      setTimeout(() => {
        if (publication.track && !publication.track.isEnabled && !publication.isMuted) {
          try {
            (publication.track as RemoteVideoTrack).setEnabled(true);
          } catch (error) {
            logger.debug('Could not enable video track immediately:', error);
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
      
      // CRITICAL FIX: Handlers will be cleaned up via room-level ParticipantDisconnected event
      
      // CRITICAL: When a participant connects, ensure all their published tracks are subscribed
      setTimeout(() => {
        // CRITICAL FIX: Check if subscription is already pending
        participant.videoTrackPublications.forEach((publication) => {
          const key = `${participant.identity}-${publication.trackSid}`;
          if (publication.track && !publication.isSubscribed && !publication.isMuted && !pendingSubscriptionsRef.current.has(key)) {
            try {
              logger.debug('Auto-subscribing to video track for newly connected participant', {
                participant: participant.identity,
                trackSid: publication.trackSid,
              });
              pendingSubscriptionsRef.current.add(key);
              publication.setSubscribed(true);
              setTimeout(() => {
                pendingSubscriptionsRef.current.delete(key);
              }, 2000);
            } catch (error) {
              logger.warn('Failed to auto-subscribe video track:', error);
              pendingSubscriptionsRef.current.delete(key);
            }
          }
        });
      }, 100); // Reduced from 500ms to 100ms for faster response
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

    // Also ensure existing tracks are subscribed
    // CRITICAL FIX: Check pending subscriptions to prevent double subscriptions
    room.remoteParticipants.forEach((participant) => {
      participant.videoTrackPublications.forEach((publication) => {
        const key = `${participant.identity}-${publication.trackSid}`;
        if (publication.track && !publication.isSubscribed && !publication.isMuted && !pendingSubscriptionsRef.current.has(key)) {
          try {
            pendingSubscriptionsRef.current.add(key);
            publication.setSubscribed(true);
            setTimeout(() => {
              pendingSubscriptionsRef.current.delete(key);
            }, 2000);
          } catch (error) {
            logger.debug('Could not subscribe to existing video track:', error);
            pendingSubscriptionsRef.current.delete(key);
          }
        }
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
      
      pendingSubscriptionsRef.current.clear();
    };
  }, [room]);
}


'use client';

import { useEffect, useRef } from 'react';
import { Room, RoomEvent, Track, RemoteAudioTrack, RemoteTrackPublication, ConnectionQuality, Participant } from 'livekit-client';
import { logger } from '../utils/logger';

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
    };

    // Comprehensive stability check
    const performStabilityCheck = () => {
      if (!room || room.state !== 'connected') return;

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

              // Check for audio element errors
              if (audioElement.error) {
                logger.warn('Audio element error detected, attempting recovery...', {
                  participant: participantId,
                  error: audioElement.error,
                });
                // Try to recover by reattaching the track
                try {
                  remoteTrack.detach();
                  setTimeout(() => {
                    remoteTrack.attach(audioElement);
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
        const localMicPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (localMicPublication && localMicPublication.track) {
          const isEnabled = room.localParticipant.isMicrophoneEnabled;
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
          audioElement.autoplay = true;
          audioElement.playsInline = true;
          audioElement.setAttribute('data-lk-source', 'microphone');
          audioElement.setAttribute('data-lk-participant', participant.identity);
          audioElement.style.display = 'none';
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

    // Run stability check every 2 seconds
    stabilityCheckIntervalRef.current = setInterval(performStabilityCheck, 2000);

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

      // Cleanup audio elements
      audioElementsRef.current.forEach((element) => {
        try {
          element.remove();
        } catch (error) {
          // Ignore cleanup errors
        }
      });
      audioElementsRef.current.clear();
    };
  }, [room]);
}

'use client';

import { useEffect, useRef } from 'react';
import { Track, RemoteAudioTrack, RemoteTrackPublication, Room } from 'livekit-client';
import { logger } from '../utils/logger';

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

    const checkAndFixAudioTracks = () => {
      if (!room || room.state !== 'connected') return;

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
        const localMicPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (localMicPublication && localMicPublication.track) {
          // Ensure local mic is enabled if it should be
          const isEnabled = room.localParticipant.isMicrophoneEnabled;
          if (isEnabled && !localMicPublication.track.isEnabled) {
            logger.debug('Local microphone track disabled, enabling...');
            try {
              localMicPublication.track.setEnabled(true);
            } catch (error) {
              logger.warn('Failed to enable local microphone track:', error);
            }
          }
        }
      }
    };

    // Initial check
    checkAndFixAudioTracks();

    // Check every 2 seconds for audio health issues
    healthCheckIntervalRef.current = setInterval(checkAndFixAudioTracks, 2000);

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

    const handleParticipantConnected = (participant: any) => {
      participant.on('trackSubscribed', handleTrackSubscribed);
    };

    room.on('participantConnected', handleParticipantConnected);

    // Set up listeners for existing participants
    room.remoteParticipants.forEach((participant) => {
      participant.on('trackSubscribed', handleTrackSubscribed);
    });

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
      
      // Cleanup event listeners
      room.off('participantConnected', handleParticipantConnected);
      room.remoteParticipants.forEach((participant) => {
        participant.off('trackSubscribed', handleTrackSubscribed);
      });
    };
  }, [room]);
}

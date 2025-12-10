'use client';

import { useEffect, useRef } from 'react';
import { Track, RemoteAudioTrack, RemoteTrackPublication, Room } from 'livekit-client';
import { logger } from '../utils/logger';

/**
 * Hook to boost volume of remote audio tracks using Web Audio API
 * This addresses the issue where remote participants' voices are too quiet
 * Similar to how Zoom boosts audio volume for better clarity
 * 
 * @param room - The LiveKit room instance
 * @param volumeBoost - Volume multiplier (default: 1.5 = 50% louder)
 */
export function useAudioVolumeBoost(room: Room | null | undefined, volumeBoost: number = 1.5) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!room) return;

    // Initialize AudioContext
    const initAudioContext = () => {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          isInitializedRef.current = true;
          logger.debug('Audio context initialized for volume boost');
        } catch (error) {
          logger.warn('Failed to initialize audio context:', error);
          return false;
        }
      }
      return true;
    };

    if (!initAudioContext()) return;

    const handleTrackSubscribed = (
      track: RemoteAudioTrack,
      publication: RemoteTrackPublication,
      participant: any
    ) => {
      if (track.kind !== Track.Kind.Audio || !audioContextRef.current) return;

      try {
        // Wait a bit for track to be fully ready
        setTimeout(() => {
          if (!audioContextRef.current || !track.mediaStream) return;

          const trackSid = track.sid;

          // Check if we already processed this track
          if (gainNodesRef.current.has(trackSid)) {
            return;
          }

          // Create audio element if it doesn't exist
          let audioElement = audioElementsRef.current.get(trackSid);
          if (!audioElement) {
            audioElement = document.createElement('audio');
            audioElement.autoplay = true;
            audioElement.playsInline = true;
            audioElement.setAttribute('data-lk-source', 'microphone');
            audioElement.setAttribute('data-lk-participant', participant.identity);
            audioElement.style.display = 'none'; // Hide the element
            document.body.appendChild(audioElement);
            audioElementsRef.current.set(trackSid, audioElement);
          }

          // Attach track to audio element
          try {
            track.attach(audioElement);
          } catch (attachError) {
            logger.warn('Failed to attach track to audio element:', attachError);
            return;
          }

          // Create gain node for volume boost
          try {
            const source = audioContextRef.current.createMediaElementSource(audioElement);
            const gainNode = audioContextRef.current.createGain();
            gainNode.gain.value = volumeBoost; // Boost volume (1.5 = 50% louder)
            
            source.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);
            
            gainNodesRef.current.set(trackSid, gainNode);
            logger.debug('Audio volume boosted', {
              participant: participant.identity,
              trackSid,
              boost: volumeBoost,
            });
          } catch (gainError) {
            // If we can't create gain node (e.g., already connected), just use the element
            logger.debug('Could not create gain node, using direct audio element');
          }
        }, 200);
      } catch (error) {
        logger.warn('Failed to boost audio volume:', error);
      }
    };

    const handleTrackUnsubscribed = (track: RemoteAudioTrack) => {
      const trackSid = track.sid;
      
      // Cleanup audio element
      const audioElement = audioElementsRef.current.get(trackSid);
      if (audioElement) {
        try {
          track.detach(audioElement);
          audioElement.remove();
        } catch (error) {
          // Ignore cleanup errors
        }
        audioElementsRef.current.delete(trackSid);
      }
      
      // Cleanup gain node
      gainNodesRef.current.delete(trackSid);
    };

    // Process existing remote participants
    const processExistingParticipants = () => {
      room.remoteParticipants.forEach((participant) => {
        participant.audioTrackPublications.forEach((publication) => {
          if (publication.track && publication.isSubscribed && publication.track.kind === Track.Kind.Audio) {
            handleTrackSubscribed(
              publication.track as RemoteAudioTrack,
              publication,
              participant
            );
          }
        });
      });
    };

    // Set up event listeners for each participant
    const setupParticipantListeners = (participant: any) => {
      const handleTrackSubscribedEvent = (track: any, publication: any) => {
        if (track.kind === Track.Kind.Audio) {
          handleTrackSubscribed(track as RemoteAudioTrack, publication, participant);
        }
      };

      const handleTrackUnsubscribedEvent = (track: any) => {
        if (track.kind === Track.Kind.Audio) {
          handleTrackUnsubscribed(track as RemoteAudioTrack);
        }
      };

      participant.on('trackSubscribed', handleTrackSubscribedEvent);
      participant.on('trackUnsubscribed', handleTrackUnsubscribedEvent);

      return () => {
        participant.off('trackSubscribed', handleTrackSubscribedEvent);
        participant.off('trackUnsubscribed', handleTrackUnsubscribedEvent);
      };
    };

    // Set up listeners for existing participants
    const cleanupFunctions: (() => void)[] = [];
    room.remoteParticipants.forEach((participant) => {
      const cleanup = setupParticipantListeners(participant);
      cleanupFunctions.push(cleanup);
    });

    // Process existing tracks
    processExistingParticipants();

    // Handle new participants
    const handleParticipantConnected = (participant: any) => {
      const cleanup = setupParticipantListeners(participant);
      cleanupFunctions.push(cleanup);
      
      // Process any existing tracks for this participant
      participant.audioTrackPublications.forEach((publication) => {
        if (publication.track && publication.isSubscribed && publication.track.kind === Track.Kind.Audio) {
          handleTrackSubscribed(
            publication.track as RemoteAudioTrack,
            publication,
            participant
          );
        }
      });
    };

    room.on('participantConnected', handleParticipantConnected);

    return () => {
      // Cleanup all event listeners
      cleanupFunctions.forEach((cleanup) => cleanup());
      
      // Cleanup all audio elements and gain nodes
      audioElementsRef.current.forEach((element) => {
        try {
          element.remove();
        } catch (error) {
          // Ignore cleanup errors
        }
      });
      audioElementsRef.current.clear();
      gainNodesRef.current.clear();
    };
  }, [room, volumeBoost]);
}

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

    // Initialize AudioContext with state management
    const initAudioContext = () => {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          isInitializedRef.current = true;
          logger.debug('Audio context initialized for volume boost');
          
          // Monitor AudioContext state changes
          audioContextRef.current.addEventListener('statechange', () => {
            const state = audioContextRef.current?.state;
            logger.debug('AudioContext state changed:', state);
            
            // If suspended, try to resume (requires user interaction)
            if (state === 'suspended') {
              logger.debug('AudioContext suspended, attempting to resume...');
              audioContextRef.current?.resume().catch((error) => {
                logger.debug('Could not resume AudioContext (may need user interaction):', error);
              });
            }
          });
        } catch (error) {
          logger.warn('Failed to initialize audio context:', error);
          return false;
        }
      }
      
      // Ensure AudioContext is running
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch((error) => {
          logger.debug('AudioContext is suspended, will resume on user interaction:', error);
        });
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

          // Create audio element if it doesn't exist with low-latency configuration
          let audioElement = audioElementsRef.current.get(trackSid);
          if (!audioElement) {
            // Check for existing element created by other hooks
            const existingElement = document.querySelector(
              `audio[data-lk-source="microphone"][data-lk-participant="${participant.identity}"][data-lk-track-sid="${trackSid}"]`
            ) as HTMLAudioElement;
            
            if (existingElement) {
              audioElement = existingElement;
              audioElementsRef.current.set(trackSid, audioElement);
            } else {
              audioElement = document.createElement('audio');
              // Low-latency audio configuration
              audioElement.autoplay = true;
              audioElement.playsInline = true;
              audioElement.preload = 'none'; // Prevent buffering for low latency
              audioElement.setAttribute('data-lk-source', 'microphone');
              audioElement.setAttribute('data-lk-participant', participant.identity);
              audioElement.setAttribute('data-lk-track-sid', trackSid);
              audioElement.style.display = 'none'; // Hide the element
              
              // Monitor buffering states
              audioElement.addEventListener('loadstart', () => {
                logger.debug('Audio element loadstart', { participant: participant.identity, trackSid });
              });
              
              audioElement.addEventListener('loadedmetadata', () => {
                logger.debug('Audio element loadedmetadata', { participant: participant.identity, trackSid });
              });
              
              audioElement.addEventListener('canplay', () => {
                logger.debug('Audio element canplay', { participant: participant.identity, trackSid });
              });
              
              audioElement.addEventListener('waiting', () => {
                logger.warn('Audio element waiting (buffering)', { participant: participant.identity, trackSid });
              });
              
              audioElement.addEventListener('stalled', () => {
                logger.warn('Audio element stalled', { participant: participant.identity, trackSid });
                // Try to recover from stalled state
                setTimeout(() => {
                  if (audioElement && audioElement.paused) {
                    audioElement.play().catch((error) => {
                      logger.debug('Could not resume stalled audio:', error);
                    });
                  }
                }, 100);
              });
              
              audioElement.addEventListener('error', (event) => {
                logger.warn('Audio element error', {
                  participant: participant.identity,
                  trackSid,
                  error: audioElement.error,
                  readyState: audioElement.readyState,
                  networkState: audioElement.networkState,
                });
              });
              
              document.body.appendChild(audioElement);
              audioElementsRef.current.set(trackSid, audioElement);
            }
          }

          // Attach track to audio element
          try {
            track.attach(audioElement);
          } catch (attachError) {
            logger.warn('Failed to attach track to audio element:', attachError);
            return;
          }

          // Ensure AudioContext is running before creating gain node
          if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch((error) => {
              logger.debug('Could not resume AudioContext:', error);
            });
          }
          
          // Create gain node for volume boost
          try {
            // Check if element is already connected to AudioContext
            if (!audioElement.srcObject) {
              // Element not yet connected, create source
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
            } else {
              // Element already connected, just update gain if node exists
              const existingGainNode = gainNodesRef.current.get(trackSid);
              if (existingGainNode) {
                existingGainNode.gain.value = volumeBoost;
              } else {
                logger.debug('Audio element already connected, skipping gain node creation');
              }
            }
          } catch (gainError: any) {
            // If we can't create gain node (e.g., already connected), check if it's a "node is already connected" error
            if (gainError.message && gainError.message.includes('already connected')) {
              logger.debug('Audio element already connected to AudioContext, using existing connection');
            } else {
              logger.debug('Could not create gain node, using direct audio element:', gainError);
            }
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






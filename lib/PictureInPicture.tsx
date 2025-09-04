'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParticipants, useLocalParticipant, VideoTrack, TrackReference } from '@livekit/components-react';
import { Track, TrackPublication } from 'livekit-client';
import styles from '@/styles/PictureInPicture.module.css';

interface PictureInPictureProps {
  room: any; // Room context
}

interface ParticipantWithPiP {
  participant: any;
  hasScreenShare: boolean;
  hasCamera: boolean;
  isLocal: boolean;
}

interface PiPPosition {
  x: number;
  y: number;
}

export function PictureInPicture({ room }: PictureInPictureProps) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [pipParticipants, setPipParticipants] = useState<ParticipantWithPiP[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [positions, setPositions] = useState<Record<string, PiPPosition>>({});
  const dragRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Test mode - set to true to show PiP for any camera-enabled participant
  const TEST_MODE = false;

  // Check if any participant has both screen share and camera active
  useEffect(() => {
    if (!room || !localParticipant || room.state !== 'connected') {
      console.log('PiP: Room not ready or local participant not available');
      return;
    }

    const checkParticipants = () => {
      const newPipParticipants: ParticipantWithPiP[] = [];
      const addedParticipants = new Set<string>(); // Track added participants to prevent duplicates

      try {
        // Skip local participant - it's already shown in the main layout
        // Only show remote participants in PiP to avoid duplicates
        console.log('Skipping local participant in PiP to avoid duplicate video cards');

        // Check remote participants
        participants.forEach((participant) => {
          try {
            const screenShareTrack = participant.getTrackPublication(Track.Source.ScreenShare);
            const cameraTrack = participant.getTrackPublication(Track.Source.Camera);
            
            const hasScreenShare = screenShareTrack?.isEnabled;
            const hasCamera = cameraTrack?.isEnabled;
            
            console.log(`Remote participant ${participant.identity} tracks:`, {
              screenShare: {
                exists: !!screenShareTrack,
                enabled: hasScreenShare,
                track: !!screenShareTrack?.track,
                source: screenShareTrack?.source
              },
              camera: {
                exists: !!cameraTrack,
                enabled: hasCamera,
                track: !!cameraTrack?.track,
                source: cameraTrack?.source
              }
            });
            
            // Show PiP only if both screen share and camera are active
            // OR if in test mode (for debugging)
            if (hasCamera && (hasScreenShare || TEST_MODE)) {
              const participantKey = `remote-${participant.identity}-${participant.sid}`;
              if (!addedParticipants.has(participantKey)) {
                console.log(`Adding remote participant ${participant.identity} to PiP`);
                newPipParticipants.push({
                  participant,
                  hasScreenShare: hasScreenShare || false,
                  hasCamera: true,
                  isLocal: false
                });
                addedParticipants.add(participantKey);
              }
            }
          } catch (error) {
            console.error(`Error checking participant ${participant.identity}:`, error);
          }
        });

        console.log('PiP participants found:', newPipParticipants.length);
        console.log('PiP participant keys:', newPipParticipants.map(p => 
          `pip-${p.isLocal ? 'local' : 'remote'}-${p.participant.identity}-${p.participant.sid}`
        ));
        console.log('PiP participants details:', newPipParticipants.map(p => ({
          identity: p.participant.identity,
          isLocal: p.isLocal,
          hasScreenShare: p.hasScreenShare,
          hasCamera: p.hasCamera,
          sid: p.participant.sid
        })));
        setPipParticipants(newPipParticipants);
        setIsVisible(newPipParticipants.length > 0);
        
        // Initialize positions for new participants
        newPipParticipants.forEach((pipParticipant) => {
          if (!positions[pipParticipant.participant.sid]) {
            setPositions(prev => ({
              ...prev,
              [pipParticipant.participant.sid]: { x: 0, y: 0 }
            }));
          }
        });
      } catch (error) {
        console.error('Error in checkParticipants:', error);
      }
    };

    // Initial check
    checkParticipants();

    // Set up event listeners for track changes
    const handleTrackPublished = (publication: TrackPublication) => {
      checkParticipants();
    };

    const handleTrackUnpublished = (publication: TrackPublication) => {
      checkParticipants();
    };

    const handleTrackMuted = (publication: TrackPublication) => {
      checkParticipants();
    };

    const handleTrackUnmuted = (publication: TrackPublication) => {
      checkParticipants();
    };

    // Listen to local participant events
    localParticipant.on('trackPublished', handleTrackPublished);
    localParticipant.on('trackUnpublished', handleTrackUnpublished);
    localParticipant.on('trackMuted', handleTrackMuted);
    localParticipant.on('trackUnmuted', handleTrackUnmuted);

    // Listen to remote participant events
    participants.forEach((participant) => {
      participant.on('trackPublished', handleTrackPublished);
      participant.on('trackUnpublished', handleTrackUnpublished);
      participant.on('trackMuted', handleTrackMuted);
      participant.on('trackUnmuted', handleTrackUnmuted);
    });

    return () => {
      try {
        if (localParticipant) {
          localParticipant.off('trackPublished', handleTrackPublished);
          localParticipant.off('trackUnpublished', handleTrackUnpublished);
          localParticipant.off('trackMuted', handleTrackMuted);
          localParticipant.off('trackUnmuted', handleTrackUnmuted);
        }

        participants.forEach((participant) => {
          try {
            participant.off('trackPublished', handleTrackPublished);
            participant.off('trackUnpublished', handleTrackUnpublished);
            participant.off('trackMuted', handleTrackMuted);
            participant.off('trackUnmuted', handleTrackUnmuted);
          } catch (error) {
            console.error(`Error removing event listeners for ${participant.identity}:`, error);
          }
        });
      } catch (error) {
        console.error('Error in PiP cleanup:', error);
      }
    };
  }, [room, localParticipant, participants, positions]);

  // Early return if room is not connected
  if (!room || room.state !== 'connected') {
    return null;
  }

  // Early return if no local participant
  if (!localParticipant) {
    return null;
  }

  // Early return if no PiP participants
  if (!isVisible || pipParticipants.length === 0) {
    return null;
  }

  // Handle mouse events for dragging
  const handleMouseDown = (e: React.MouseEvent, participantId: string) => {
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const deltaX = e.clientX - dragStart.current.x;
        const deltaY = e.clientY - dragStart.current.y;
        
        setPositions(prev => ({
          ...prev,
          [participantId]: {
            x: (prev[participantId]?.x || 0) + deltaX,
            y: (prev[participantId]?.y || 0) + deltaY
          }
        }));
        
        dragStart.current = { x: e.clientX, y: e.clientY };
      }
    };
    
    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!isVisible || pipParticipants.length === 0) {
    return null;
  }

  // Filter out participants with invalid data
  const validPipParticipants = pipParticipants.filter(pipParticipant => 
    pipParticipant.participant && 
    pipParticipant.participant.sid && 
    pipParticipant.participant.identity
  );

  if (validPipParticipants.length === 0) {
    return null;
  }

  if (isMinimized) {
    return (
      <div className={styles.pipMinimized} onClick={() => setIsMinimized(false)}>
        <span>📺 {validPipParticipants.length}</span>
      </div>
    );
  }

  return (
    <div className={styles.pipContainer}>
      {/* Minimize button */}
      <button
        className={styles.minimizeButton}
        onClick={() => setIsMinimized(true)}
        title="Minimize PiP"
      >
        ➖
      </button>
      
      {validPipParticipants
        .map((pipParticipant) => {
          try {
            // Safety check for participant data
            if (!pipParticipant?.participant?.sid || !pipParticipant?.participant?.identity) {
              console.warn('PiP: Invalid participant data, skipping:', pipParticipant);
              return null;
            }

          let cameraTrack;
          try {
            // Validate participant exists and has the required method
            if (!pipParticipant.participant || typeof pipParticipant.participant.getTrackPublication !== 'function') {
              console.warn(`PiP: Invalid participant object for ${pipParticipant.participant?.identity || 'unknown'}`);
              return null;
            }
            
            cameraTrack = pipParticipant.participant.getTrackPublication(Track.Source.Camera);
            console.log(`PiP: Camera track for ${pipParticipant.participant.identity}:`, {
              exists: !!cameraTrack,
              enabled: cameraTrack?.isEnabled,
              hasTrack: !!cameraTrack?.track,
              hasMediaStreamTrack: !!cameraTrack?.track?.mediaStreamTrack,
              source: cameraTrack?.source,
              trackSid: cameraTrack?.trackSid
            });
          } catch (error) {
            console.error(`Error getting camera track for ${pipParticipant.participant.identity}:`, error);
            cameraTrack = null;
          }
          
          // Comprehensive validation for cameraTrack
          const isValidCameraTrack = cameraTrack && 
                                   typeof cameraTrack === 'object' &&
                                   cameraTrack.isEnabled && 
                                   cameraTrack.track &&
                                   cameraTrack.track.mediaStreamTrack;
          
          console.log(`PiP: Camera track validation for ${pipParticipant.participant.identity}:`, {
            cameraTrack: !!cameraTrack,
            isObject: cameraTrack && typeof cameraTrack === 'object',
            isEnabled: cameraTrack?.isEnabled,
            hasTrack: !!cameraTrack?.track,
            hasMediaStreamTrack: !!cameraTrack?.track?.mediaStreamTrack,
            isValid: isValidCameraTrack
          });
          
          if (!isValidCameraTrack) {
            console.warn(`PiP: Invalid camera track for ${pipParticipant.participant.identity}, skipping render`);
            return null;
          }
          
          // Create proper TrackReference for VideoTrack component
          const trackRef: TrackReference = {
            participant: pipParticipant.participant,
            publication: cameraTrack,
            source: Track.Source.Camera
          };
          
          const position = positions[pipParticipant.participant.sid] || { x: 0, y: 0 };
          
          return (
            <div
              key={`pip-${pipParticipant.isLocal ? 'local' : 'remote'}-${pipParticipant.participant.identity}-${pipParticipant.participant.sid}`}
              className={styles.pipParticipant}
              style={{
                transform: `translate(${position.x}px, ${position.y}px)`
              }}
              onMouseDown={(e) => handleMouseDown(e, pipParticipant.participant.sid)}
            >
              <div>
                {isValidCameraTrack ? (
                  (() => {
                    try {
                      return (
                        <VideoTrack
                          trackRef={trackRef}
                          className={styles.pipVideo}
                        />
                      );
                    } catch (error) {
                      console.error(`PiP: Error rendering VideoTrack for ${pipParticipant.participant.identity}:`, error);
                      return (
                        <div className={styles.pipVideo} style={{
                          backgroundColor: '#333',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '12px'
                        }}>
                          Video Error
                        </div>
                      );
                    }
                  })()
                ) : (
                  <div className={styles.pipVideo} style={{
                    backgroundColor: '#333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '12px'
                  }}>
                    No Camera
                  </div>
                )}
                {/* Debug info */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  color: 'white',
                  padding: '4px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  pointerEvents: 'none'
                }}>
                  Camera Active
                </div>
              </div>
              
              {/* Participant info overlay */}
              <div className={styles.pipInfo}>
                <span style={{ fontSize: '10px' }}>
                  {pipParticipant.isLocal ? '📱' : '👤'}
                </span>
                <span className={styles.pipParticipantName}>
                  {pipParticipant.isLocal ? 'You' : pipParticipant.participant.identity}
                </span>
                <span style={{ fontSize: '10px' }}>📹</span>
              </div>

              {/* Screen share indicator */}
              <div className={styles.screenShareIndicator}>
                📺
              </div>
              
              {/* Track type indicator */}
              <div className={styles.trackTypeIndicator}>
                📹 Camera
              </div>
            </div>
          );
          } catch (error) {
            console.error('PiP: Error rendering participant:', error, pipParticipant);
            return null;
          }
        })
        .filter(Boolean) // Remove any null values
      }
    </div>
  );
}

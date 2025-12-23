'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { useRoomContext, useLocalParticipant, useParticipants, VideoTrack } from '@livekit/components-react';
import { Track, TrackPublication, VideoQuality, RemoteTrackPublication, RemoteTrack } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, MoreVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from '@/styles/StudentMonitorPiP.module.css';

interface Position {
  x: number;
  y: number;
}

interface StudentMonitorPiPProps {
  isHost?: boolean;
  disabled?: boolean;
  showProBadge?: boolean;
  roomName?: string;
}

// Custom hook to get participants that only updates when participants are added/removed, not on track events
function useStableParticipants() {
  const allParticipants = useParticipants();
  const [stableParticipants, setStableParticipants] = useState(allParticipants);
  const sidsRef = useRef<string>('');
  
  const currentSids = useMemo(() => 
    allParticipants.map(p => p.sid).sort().join(','), 
    [allParticipants.length, allParticipants.map(p => p.sid).join(',')]
  );
  
  useEffect(() => {
    // Only update if participant SIDs changed (participant added/removed)
    if (currentSids !== sidsRef.current) {
      sidsRef.current = currentSids;
      setStableParticipants(allParticipants);
    }
  }, [currentSids, allParticipants]);
  
  return stableParticipants;
}

function StudentMonitorPiPComponent({ isHost = false, disabled = false, showProBadge = false, roomName }: StudentMonitorPiPProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useStableParticipants();
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isManuallyEnabled, setIsManuallyEnabled] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef<Position>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const positionInitialized = useRef(false);
  const manualEnableRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [lockedDimensions, setLockedDimensions] = useState<{ width: number; height: number } | null>(null);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  
  // Persist manual enable state in sessionStorage
  const STORAGE_KEY = 'student-monitor-manually-enabled';
  const MINIMIZED_KEY = 'student-monitor-minimized';
  
  // Ensure component is mounted before rendering portal (client-side only)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle window resize to recalculate layout
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const updateWindowSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    // Set initial size
    updateWindowSize();
    
    window.addEventListener('resize', updateWindowSize);
    return () => window.removeEventListener('resize', updateWindowSize);
  }, []);
  
  // Load persisted state on mount - but don't auto-enable by default
  useEffect(() => {
    // Don't restore persisted state on initial load - start fresh each session
    // User must explicitly click the button to show the monitor
    manualEnableRef.current = false;
    setIsManuallyEnabled(false);
    sessionStorage.removeItem(STORAGE_KEY);
    
    // Don't restore minimized state either - start fresh
    setIsMinimized(false);
    sessionStorage.removeItem(MINIMIZED_KEY);
  }, []);

  // Detect screen sharing
  useEffect(() => {
    if (!room || !localParticipant || room.state !== 'connected') {
      setIsScreenSharing(false);
      return;
    }

    const checkScreenShare = () => {
      try {
        const screenShareTrack = localParticipant.getTrackPublication(Track.Source.ScreenShare);
        const hasScreenShare = screenShareTrack?.isEnabled && !!screenShareTrack?.track;
        
        let foundScreenShare = hasScreenShare;
        if (!foundScreenShare) {
          for (const publication of localParticipant.trackPublications.values()) {
            if (publication.source === Track.Source.ScreenShare && publication.isEnabled && publication.track) {
              foundScreenShare = true;
              break;
            }
          }
        }
        
        setIsScreenSharing(!!foundScreenShare);
      } catch (error) {
        console.error('Error checking screen share:', error);
        setIsScreenSharing(false);
      }
    };

    checkScreenShare();

    const handleTrackPublished = (publication: TrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) {
        checkScreenShare();
      }
    };

    const handleTrackUnpublished = (publication: TrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) {
        checkScreenShare();
      }
    };

    localParticipant.on('trackPublished', handleTrackPublished);
    localParticipant.on('trackUnpublished', handleTrackUnpublished);

    return () => {
      localParticipant.off('trackPublished', handleTrackPublished);
      localParticipant.off('trackUnpublished', handleTrackUnpublished);
    };
  }, [room, localParticipant]);

  // Initialize position - start at 0,0 (base position set in CSS like PictureInPicture)
  useEffect(() => {
    if ((isScreenSharing || isManuallyEnabled || manualEnableRef.current) && !positionInitialized.current) {
      setPosition({ x: 0, y: 0 });
      positionInitialized.current = true;
    }
    
    if (!isScreenSharing && !isManuallyEnabled && !manualEnableRef.current) {
      positionInitialized.current = false;
      setPosition({ x: 0, y: 0 });
    }
  }, [isScreenSharing, isManuallyEnabled]);

  // Handle dragging - EXACTLY like PictureInPicture
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(`.${styles.dragHandle}`) || target.closest(`.${styles.header}`)) {
      e.preventDefault();
      e.stopPropagation();
      
      // Lock dimensions when dragging starts
      if (containerRef.current) {
        setLockedDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
      
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      
      const handleMouseMove = (e: MouseEvent) => {
        if (isDragging.current) {
          const deltaX = e.clientX - dragStart.current.x;
          const deltaY = e.clientY - dragStart.current.y;
          
          // Update position - no boundaries, free movement
          setPosition(prev => ({
            x: prev.x + deltaX,
            y: prev.y + deltaY
          }));
          
          dragStart.current = { x: e.clientX, y: e.clientY };
        }
      };
      
      const handleMouseUp = () => {
        isDragging.current = false;
        setLockedDimensions(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  // Helper function to clean participant names (remove _host_, _guest_ suffixes and roomname)
  // Moved outside component logic - pure function, doesn't need to be recreated
  const getCleanName = useCallback((identity: string): string => {
    // Remove patterns like _guest_roomname or _host_roomname
    // Handles formats like: "215_guest_romname" -> "215"
    return identity.replace(/_(host|guest)_.*$/, '').trim();
  }, []);

  // Filter students (all remote participants, excluding local and observers)
  // Use ref to track participant SIDs and only update when they actually change
  const participantsRef = useRef<string>('');
  const studentsRef = useRef<any[]>([]);
  
  const currentParticipantSids = participants
    .filter(p => p.identity !== localParticipant?.identity && 
                  p.identity !== 'observer' &&
                  !p.isLocal)
    .map(p => p.sid)
    .sort()
    .join(',');
  
  // Only update students when participant SIDs actually change
  const students = useMemo(() => {
    if (participantsRef.current !== currentParticipantSids) {
      participantsRef.current = currentParticipantSids;
      studentsRef.current = participants.filter(participant => {
        return participant.identity !== localParticipant?.identity && 
               participant.identity !== 'observer' &&
               !participant.isLocal;
      });
    }
    return studentsRef.current;
  }, [currentParticipantSids, participants, localParticipant?.identity]);

  // Handle manual enable
  const handleManualEnable = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    manualEnableRef.current = true;
    setIsManuallyEnabled(true);
    sessionStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  // Host control functions
  const muteParticipant = useCallback(async (participantIdentity: string, shouldMute: boolean) => {
    if (!isHost || !roomName || !room || !localParticipant) {
      console.error('Cannot mute: isHost=', isHost, 'roomName=', roomName, 'room=', !!room, 'localParticipant=', !!localParticipant);
      return;
    }

    try {
      if (shouldMute) {
        // Force mute via API (server-side enforcement)
        console.log('Muting participant via API:', { participantIdentity, roomName: room?.name || roomName });
        const response = await fetch('/api/room/controls/mute-participant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: room?.name || roomName,
            participantIdentity,
            mute: true
          })
        });

        const result = await response.json();
        
        if (response.ok) {
          console.log('Mute API success:', result);
          
          // Also send data channel message to notify student and update their UI
          try {
            const muteRequest = {
              type: 'mute_command',
              targetParticipant: participantIdentity,
              sender: localParticipant.identity,
              timestamp: Date.now(),
              allowUnmute: false // Server-side mute, student can't unmute themselves
            };

            const encodedData = new TextEncoder().encode(JSON.stringify(muteRequest));
            await room.localParticipant.publishData(encodedData, { topic: 'mute-control', reliable: true });
            console.log('Mute data channel message sent');
          } catch (dataChannelError) {
            console.warn('Failed to send mute data channel message (API mute still applied):', dataChannelError);
            // Don't fail the whole operation if data channel fails - API mute is the important part
          }
          
          toast.success('Participant muted');
        } else {
          console.error('Mute API error:', result);
          toast.error(result.error || 'Failed to mute');
        }
      } else {
        // Unmute via data channel (API doesn't support unmuting, only muting)
        console.log('Unmuting participant via data channel:', { participantIdentity });
        try {
          const unmuteRequest = {
            type: 'unmute_command',
            targetParticipant: participantIdentity,
            sender: localParticipant.identity,
            timestamp: Date.now(),
            allowUnmute: true // This will actually unmute the student
          };

          const encodedData = new TextEncoder().encode(JSON.stringify(unmuteRequest));
          await room.localParticipant.publishData(encodedData, { topic: 'mute-control', reliable: true });
          console.log('Unmute data channel message sent');
          
          toast.success('Participant unmuted');
        } catch (error) {
          console.error('Error sending unmute request:', error);
          toast.error('Failed to unmute participant');
        }
      }
    } catch (error) {
      console.error('Error muting/unmuting participant:', error);
      toast.error('Network error occurred');
    }
  }, [isHost, roomName, room, localParticipant]);

  const controlVideo = useCallback(async (participantIdentity: string, shouldDisable: boolean) => {
    if (!isHost || !roomName || !room || !localParticipant) {
      console.error('Cannot control video: isHost=', isHost, 'roomName=', roomName, 'room=', !!room, 'localParticipant=', !!localParticipant);
      return;
    }

    if (shouldDisable) {
      // Disable video via API (server-side enforcement)
      try {
        console.log('Stopping video via API:', { participantIdentity, roomName: room?.name || roomName });
        const response = await fetch('/api/room/controls/video-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: room?.name || roomName,
            participantIdentity,
            disable: true
          })
        });

        const result = await response.json();

        if (response.ok) {
          console.log('Video control API success:', result);
          
          // Also send data channel message to notify student and update their UI
          try {
            const videoRequest = {
              type: 'video_request_off',
              targetParticipant: participantIdentity,
              requestType: 'camera_off',
              sender: localParticipant.identity,
              timestamp: Date.now(),
              id: `request-${Date.now()}`
            };

            const encodedData = new TextEncoder().encode(JSON.stringify(videoRequest));
            await room.localParticipant.publishData(encodedData, { topic: 'video-request', reliable: true });
            console.log('Video stop data channel message sent');
          } catch (dataChannelError) {
            console.warn('Failed to send video stop data channel message (API stop still applied):', dataChannelError);
            // Don't fail the whole operation if data channel fails - API stop is the important part
          }
          
          toast.success('Video stopped');
        } else {
          console.error('Video control API error:', result);
          toast.error(result.error || 'Failed to stop video');
        }
      } catch (error) {
        console.error('Error controlling video:', error);
        toast.error('Network error occurred');
      }
    } else {
      // Request video on via data channel
      try {
        console.log('Requesting video on for:', { participantIdentity });
        const request = {
          type: 'video_request_on',
          targetParticipant: participantIdentity,
          requestType: 'camera_on',
          sender: localParticipant.identity,
          timestamp: Date.now(),
          id: `request-${Date.now()}`
        };

        const encodedData = new TextEncoder().encode(JSON.stringify(request));
        await room.localParticipant.publishData(encodedData, { topic: 'video-request', reliable: true });
        
        toast.success('Request sent to participant');
      } catch (error) {
        console.error('Error sending video request:', error);
        toast.error('Failed to send request');
      }
    }
  }, [isHost, roomName, room, localParticipant]);

  // Sync ref with state and persist
  useEffect(() => {
    if (isManuallyEnabled) {
      manualEnableRef.current = true;
      sessionStorage.setItem(STORAGE_KEY, 'true');
    } else if (!isManuallyEnabled && !isScreenSharing) {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [isManuallyEnabled, isScreenSharing]);

  // Persist minimized state
  useEffect(() => {
    if (isMinimized) {
      sessionStorage.setItem(MINIMIZED_KEY, 'true');
    } else {
      sessionStorage.removeItem(MINIMIZED_KEY);
    }
  }, [isMinimized]);

  // Open Document Picture-in-Picture window
  const openDocumentPiP = useCallback(async () => {
    try {
      // Check if Document PiP API is supported
      if ('documentPictureInPicture' in window) {
        // Calculate PiP window size based on number of students (no header in PiP)
        const padding = 4; // Minimal padding
        const cardHeight = 240; // Increased height for better video display
        const gap = 6; // Slightly reduced gap
        const minWidth = 280; // Increased minimum width for better visibility
        const maxWidth = 320; // Increased maximum width for better visibility
        const cardCount = Math.max(1, students.length);
        const visibleCards = Math.min(cardCount, 5); // Show 5 cards with taller height
        const cardsHeight = cardHeight * visibleCards + gap * Math.max(0, visibleCards - 1);
        const pipWidth = Math.max(minWidth, Math.min(maxWidth, 300)); // Wider width for better visibility
        const pipHeight = cardsHeight + padding * 2; // No header height in PiP
        
        const pip = await (window as any).documentPictureInPicture.requestWindow({
          width: pipWidth,
          height: pipHeight,
        });
        
        // Set up PiP window styling - dark background to match container
        pip.document.documentElement.style.margin = '0';
        pip.document.documentElement.style.padding = '0';
        pip.document.documentElement.style.width = '100%';
        pip.document.documentElement.style.height = '100%';
        pip.document.documentElement.style.background = '#0f172a';
        pip.document.documentElement.style.overflow = 'hidden';
        
        pip.document.body.style.margin = '0';
        pip.document.body.style.padding = '0';
        pip.document.body.style.width = '100%';
        pip.document.body.style.height = '100%';
        pip.document.body.style.background = '#0f172a';
        pip.document.body.style.overflow = 'hidden';
        pip.document.body.style.display = 'block';
        
        // Copy all stylesheets to the PiP window
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
            const style = pip.document.createElement('style');
            style.textContent = cssRules;
            pip.document.head.appendChild(style);
          } catch (e) {
            // Some stylesheets might have CORS issues, try linking them instead
            const link = pip.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = (styleSheet as any).href;
            pip.document.head.appendChild(link);
          }
        });
        
        // Handle PiP window close event
        const handlePipClose = () => {
          console.log('PiP window closed, returning to main window');
          setPipWindow(null);
          // Don't hide the monitor when PiP closes - keep it visible in main window
        };
        
        pip.addEventListener('pagehide', handlePipClose);
        pip.addEventListener('unload', handlePipClose);
        pip.addEventListener('beforeunload', handlePipClose);
        
        setPipWindow(pip);
      } else {
        alert('Document Picture-in-Picture is not supported in this browser. Try Chrome 116+');
      }
    } catch (error) {
      console.error('Failed to open PiP window:', error);
    }
  }, []);

  // Close Document PiP window
  const closeDocumentPiP = useCallback(() => {
    console.log('Closing PiP window manually');
    
    // Reset drag state to prevent stuck dragging
    isDragging.current = false;
    setLockedDimensions(null);
    
    if (pipWindow && !pipWindow.closed) {
      pipWindow.close();
    }
    setPipWindow(null);
    // Keep the monitor visible in the main window - don't hide it
  }, [pipWindow]);

  // Cleanup PiP window on unmount
  useEffect(() => {
    return () => {
      if (pipWindow && !pipWindow.closed) {
        pipWindow.close();
      }
    };
  }, [pipWindow]);

  // Show only if manually enabled (not auto-show on screen share)
  // User must explicitly click the button to show the monitor
  const persistedEnabled = typeof window !== 'undefined' && sessionStorage.getItem(STORAGE_KEY) === 'true';
  const shouldShow = (isManuallyEnabled || manualEnableRef.current || persistedEnabled);

  // Calculate container dimensions for column layout
  const headerHeight = 50;
  const padding = 4; // Minimal padding
  const cardHeight = 200; // Increased height a little more
  const gap = 6; // Slightly reduced gap
  const minWidth = 280; // Increased minimum width for better visibility
  const maxWidth = 320; // Increased maximum width for better visibility
  const maxVisibleCards = 5; // Show 5 cards before scrolling
  
  const containerWidth = Math.max(minWidth, Math.min(maxWidth, 300)); // Wider width for better visibility
  const cardCount = Math.max(1, students.length);
  const visibleCards = Math.min(cardCount, maxVisibleCards);
  const cardsHeight = cardHeight * visibleCards + gap * Math.max(0, visibleCards - 1);
  const containerHeight = headerHeight + cardsHeight + padding * 2;

  // Participant context menu component (for PiP window)
  const ParticipantContextMenu = ({ participant, isOpen, onClose, position, onMute, onVideoControl }: {
    participant: any;
    isOpen: boolean;
    onClose: () => void;
    position: { top: number; left: number };
    onMute: (identity: string, mute: boolean) => void;
    onVideoControl: (identity: string, disable: boolean) => void;
  }) => {
    // Helper function to get current track state
    const getTrackState = () => {
      const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
      const videoTrack = participant.getTrackPublication(Track.Source.Camera);
      
      // For audio: track exists, is enabled, and not muted
      const audioIsEnabled = audioTrack && audioTrack.isEnabled && !audioTrack.isMuted;
      
      // For video: track exists, is enabled, not muted, and has an actual track
      const videoIsEnabled = videoTrack && videoTrack.isEnabled && !videoTrack.isMuted && !!videoTrack.track;
      
      return {
        audioEnabled: !!audioIsEnabled,
        videoEnabled: !!videoIsEnabled
      };
    };

    // Initialize state with current values
    const initialState = getTrackState();
    const [audioEnabled, setAudioEnabled] = useState(initialState.audioEnabled);
    const [videoEnabled, setVideoEnabled] = useState(initialState.videoEnabled);

    // Update state when menu opens or participant changes
    useEffect(() => {
      if (!isOpen) return;

      const updateState = () => {
        const state = getTrackState();
        setAudioEnabled(state.audioEnabled);
        setVideoEnabled(state.videoEnabled);
      };

      // Update immediately
      updateState();
      
      // Listen to track events for immediate updates
      const handleTrackMuted = () => updateState();
      const handleTrackUnmuted = () => updateState();
      const handleTrackPublished = () => updateState();
      const handleTrackUnpublished = () => updateState();
      
      participant.on('trackMuted', handleTrackMuted);
      participant.on('trackUnmuted', handleTrackUnmuted);
      participant.on('trackPublished', handleTrackPublished);
      participant.on('trackUnpublished', handleTrackUnpublished);
      
      // Update state periodically while menu is open (as fallback)
      const interval = setInterval(updateState, 300);
      
      return () => {
        participant.off('trackMuted', handleTrackMuted);
        participant.off('trackUnmuted', handleTrackUnmuted);
        participant.off('trackPublished', handleTrackPublished);
        participant.off('trackUnpublished', handleTrackUnpublished);
        clearInterval(interval);
      };
    }, [isOpen, participant]);
    
    if (!isOpen) {
      return null;
    }

    return (
      <>
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999998,
            backgroundColor: 'transparent'
          }}
          onClick={onClose}
        />
        <div
          className={styles.contextMenu}
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            zIndex: 999999,
            minWidth: '180px'
          }}
        >
          <button
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                console.log('Mute button clicked:', { audioEnabled, participantIdentity: participant.identity });
                await onMute(participant.identity, audioEnabled);
                setTimeout(() => {
                  const state = getTrackState();
                  setAudioEnabled(state.audioEnabled);
                }, 500);
              } catch (error) {
                console.error('Error in mute button:', error);
              } finally {
                onClose();
              }
            }}
            className={styles.contextMenuItem}
          >
            {audioEnabled ? <MicOff size={16} /> : <Mic size={16} />}
            <span>{audioEnabled ? 'Mute' : 'Unmute'}</span>
          </button>
          <button
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                console.log('Video control button clicked:', { videoEnabled, participantIdentity: participant.identity });
                await onVideoControl(participant.identity, videoEnabled);
                setTimeout(() => {
                  const state = getTrackState();
                  setVideoEnabled(state.videoEnabled);
                }, 500);
              } catch (error) {
                console.error('Error in video control button:', error);
              } finally {
                onClose();
              }
            }}
            className={styles.contextMenuItem}
          >
            {videoEnabled ? <VideoOff size={16} /> : <Video size={16} />}
            <span>{videoEnabled ? 'Stop video' : 'Start video'}</span>
          </button>
        </div>
      </>
    );
  };

  // Participant card component - Memoized to prevent unnecessary re-renders
  const ParticipantCard = memo(({ student, onMute, onVideoControl, isInPiP = false }: {
    student: any;
    onMute: (identity: string, mute: boolean) => void;
    onVideoControl: (identity: string, disable: boolean) => void;
    isInPiP?: boolean;
  }) => {
    // Get tracks - these might change reference but trackSid is stable
    const cameraTrackPub = student.getTrackPublication(Track.Source.Camera);
    const audioTrackPub = student.getTrackPublication(Track.Source.Microphone);
    
    // Memoize based on trackSid to get stable references
    const cameraTrack = useMemo(() => {
      return cameraTrackPub;
    }, [cameraTrackPub?.trackSid, student.sid]);
    
    const audioTrack = useMemo(() => {
      return audioTrackPub;
    }, [audioTrackPub?.trackSid, student.sid]);
    
    // Use state hooks to track track state reactively
    const [isMuted, setIsMuted] = useState(() => !audioTrack?.isEnabled || audioTrack?.isMuted);
    // For video: track exists, is enabled, not muted, and has an actual track
    const [hasVideo, setHasVideo] = useState(() => {
      return cameraTrack && cameraTrack.isEnabled && !cameraTrack.isMuted && !!cameraTrack.track;
    });
    
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const cardRef = useRef<HTMLDivElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const qualitySetRef = useRef(false);
    const trackIdRef = useRef<string | null>(null);
    const cameraTrackRef = useRef(cameraTrack);
    
    // Update ref when track changes
    useEffect(() => {
      cameraTrackRef.current = cameraTrack;
    }, [cameraTrack?.trackSid]);

    // Update track state reactively when tracks change - ONLY FOR AUDIO
    useEffect(() => {
      const updateAudioState = () => {
        const currentAudioTrack = student.getTrackPublication(Track.Source.Microphone);
        const newIsMuted = !currentAudioTrack?.isEnabled || currentAudioTrack?.isMuted;
        
        setIsMuted(prev => {
          if (prev !== newIsMuted) {
            return newIsMuted;
          }
          return prev;
        });
      };

      updateAudioState();
      
      // Only listen to audio events
      const handleTrackMuted = (pub: TrackPublication) => {
        if (pub.source === Track.Source.Microphone) {
          updateAudioState();
        }
      };
      const handleTrackUnmuted = (pub: TrackPublication) => {
        if (pub.source === Track.Source.Microphone) {
          updateAudioState();
        }
      };
      
      student.on('trackMuted', handleTrackMuted);
      student.on('trackUnmuted', handleTrackUnmuted);
      
      return () => {
        student.off('trackMuted', handleTrackMuted);
        student.off('trackUnmuted', handleTrackUnmuted);
      };
    }, [student]);

    // Update VIDEO state separately - ONLY when video track actually changes
    useEffect(() => {
      const updateVideoState = () => {
        const currentCameraTrack = student.getTrackPublication(Track.Source.Camera);
        const newHasVideo = currentCameraTrack && 
                            currentCameraTrack.isEnabled && 
                            !currentCameraTrack.isMuted && 
                            !!currentCameraTrack.track;
        
        setHasVideo(prev => {
          if (prev !== newHasVideo) {
            return newHasVideo;
          }
          return prev;
        });
      };

      updateVideoState();

      // Only listen to VIDEO events
      const handleTrackSubscribed = (track: RemoteTrack, pub: RemoteTrackPublication) => {
        if (pub.source === Track.Source.Camera) {
          updateVideoState();
        }
      };
      const handleTrackUnsubscribed = (track: RemoteTrack, pub: RemoteTrackPublication) => {
        if (pub.source === Track.Source.Camera) {
          updateVideoState();
        }
      };
      const handleTrackMuted = (pub: TrackPublication) => {
        if (pub.source === Track.Source.Camera) {
          updateVideoState();
        }
      };
      const handleTrackUnmuted = (pub: TrackPublication) => {
        if (pub.source === Track.Source.Camera) {
          updateVideoState();
        }
      };

      student.on('trackSubscribed', handleTrackSubscribed);
      student.on('trackUnsubscribed', handleTrackUnsubscribed);
      student.on('trackMuted', handleTrackMuted);
      student.on('trackUnmuted', handleTrackUnmuted);

      return () => {
        student.off('trackSubscribed', handleTrackSubscribed);
        student.off('trackUnsubscribed', handleTrackUnsubscribed);
        student.off('trackMuted', handleTrackMuted);
        student.off('trackUnmuted', handleTrackUnmuted);
      };
    }, [student]);

    // Set video quality ONCE per track - using trackSid as the key
    useEffect(() => {
      if (!cameraTrack || !(cameraTrack instanceof RemoteTrackPublication)) {
        return;
      }

      const currentTrackId = cameraTrack.trackSid;
      
      // Only set quality if this is a new track
      if (trackIdRef.current !== currentTrackId) {
        trackIdRef.current = currentTrackId;
        qualitySetRef.current = false;
      }

      // Set quality once per track
      if (!qualitySetRef.current && cameraTrack.track) {
        try {
          cameraTrack.setVideoQuality(VideoQuality.MEDIUM);
          if (!cameraTrack.isSubscribed) {
            cameraTrack.setSubscribed(true);
          }
          qualitySetRef.current = true;
        } catch (error) {
          console.error('[StudentMonitor] Failed to set video quality:', error);
        }
      }
    }, [cameraTrack?.trackSid, student.identity]);

    const handleAudioClick = useCallback(async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await onMute(student.identity, !isMuted);
      } catch (error) {
        console.error('Error in audio button:', error);
      }
    }, [student.identity, isMuted, onMute]);

    const handleVideoClick = useCallback(async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await onVideoControl(student.identity, hasVideo);
      } catch (error) {
        console.error('Error in video button:', error);
      }
    }, [student.identity, hasVideo, onVideoControl]);

    const handleMenuClick = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const menuLeft = Math.max(10, rect.left);
        const menuTop = rect.top + 35;
        
        const menuWidth = 180;
        const maxLeft = window.innerWidth - menuWidth - 10;
        const finalLeft = Math.min(menuLeft, maxLeft);
        
        const newPosition = {
          top: menuTop,
          left: finalLeft
        };
        
        setMenuPosition(newPosition);
      }
      
      setMenuOpen(!menuOpen);
    }, [menuOpen]);

    // Memoize the video track key and trackRef to prevent remounting
    const videoTrackKey = useMemo(() => {
      return `video-${student.sid}-${cameraTrack?.trackSid || 'no-track'}`;
    }, [student.sid, cameraTrack?.trackSid]);
    
    // Create stable trackRef object that doesn't change unless track actually changes
    const trackRef = useMemo(() => {
      if (!cameraTrack || !cameraTrack.track) {
        return null;
      }
      return {
        participant: student,
        publication: cameraTrack,
        source: Track.Source.Camera as const
      };
    }, [student.sid, cameraTrack?.trackSid, cameraTrack?.track]);

    return (
      <div
        ref={cardRef}
        className={styles.studentCard}
      >
        {/* Video/Avatar fills entire card */}
        {hasVideo && trackRef ? (
          <div 
            ref={videoContainerRef}
            className={styles.videoContainer}
            style={{ 
              minWidth: '1px', 
              minHeight: '1px',
              position: 'relative'
            }}
          >
            <VideoTrack
              key={videoTrackKey}
              trackRef={trackRef}
              className={styles.studentVideo}
            />
          </div>
        ) : (
          <div className={styles.placeholder}>
            <div className={styles.placeholderInitial}>
              {getCleanName(student.identity).charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* For PiP window: Show 3-dots menu button and status indicators */}
        {isInPiP ? (
          <>
            <button
              className={styles.menuButton}
              onClick={handleMenuClick}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              title="More options"
              type="button"
            >
              <MoreVertical size={18} />
            </button>
            {/* Audio control button - top left, below menu button */}
            <button
              className={styles.controlButton}
              onClick={handleAudioClick}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              title={isMuted ? "Unmute" : "Mute"}
              type="button"
              style={{
                top: '46px', // Below menu button with padding
                color: isMuted ? '#ef4444' : '#22c55e' // Red when muted, green when unmuted
              }}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            {/* Video control button - top left, below audio button */}
            <button
              className={styles.controlButton}
              onClick={handleVideoClick}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              title={hasVideo ? "Stop video" : "Start video"}
              type="button"
              style={{
                top: '80px', // Below audio button with padding
                color: hasVideo ? '#22c55e' : '#ef4444' // Green when video on, red when off
              }}
            >
              {hasVideo ? <Video size={18} /> : <VideoOff size={18} />}
            </button>
            <ParticipantContextMenu
              participant={student}
              isOpen={menuOpen}
              onClose={() => setMenuOpen(false)}
              position={menuPosition}
              onMute={onMute}
              onVideoControl={onVideoControl}
            />
          </>
        ) : (
          <>
            {/* For main window: Show direct control buttons */}
            {/* Audio control button - top left */}
            <button
              className={styles.controlButton}
              onClick={handleAudioClick}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              title={isMuted ? "Unmute" : "Mute"}
              type="button"
              style={{
                color: isMuted ? '#ef4444' : '#22c55e' // Red when muted, green when unmuted
              }}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Video control button - top left, below audio button with padding */}
            <button
              className={styles.controlButton}
              style={{ 
                top: '46px', // 8px (top) + 32px (button height) + 6px (padding) = 46px
                color: hasVideo ? '#22c55e' : '#ef4444' // Green when video on, red when off
              }}
              onClick={handleVideoClick}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              title={hasVideo ? "Stop video" : "Start video"}
              type="button"
            >
              {hasVideo ? <Video size={18} /> : <VideoOff size={18} />}
            </button>
          </>
        )}

        {/* Name overlay - bottom */}
        <div className={styles.studentNameOverlay}>
          <span className={styles.studentName} title={student.identity}>
            {getCleanName(student.identity)}
          </span>
        </div>
      </div>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison function for memo
    // Return true if props are equal (skip re-render), false if different (re-render)
    const studentSame = prevProps.student.sid === nextProps.student.sid &&
                        prevProps.student.identity === nextProps.student.identity;
    const isInPiPSame = prevProps.isInPiP === nextProps.isInPiP;
    const functionsSame = prevProps.onMute === nextProps.onMute &&
                          prevProps.onVideoControl === nextProps.onVideoControl;
    
    // Only re-render if something actually changed
    return studentSame && isInPiPSame && functionsSame;
  });

  ParticipantCard.displayName = 'ParticipantCard';

  // Check if we're in PiP window
  const isInPiP = !!(pipWindow && !pipWindow.closed && pipWindow.document && pipWindow.document.body);

  // Memoize main container to prevent re-renders
  const mainContainer = useMemo(() => (
    <div
      ref={containerRef}
      className={styles.container}
      data-pip={isInPiP ? 'true' : 'false'}
      style={{
        // In PiP window: fill 100% width/height, no transform
        // In main window: use calculated dimensions and transform
        ...(isInPiP ? {
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          width: '100%',
          height: '100%',
          transform: 'none',
          borderRadius: '0',
          border: 'none',
          padding: '0' // No padding in PiP
        } : {
          transform: `translate(${position.x}px, ${position.y}px)`,
          ...(lockedDimensions ? {
            width: `${lockedDimensions.width}px`,
            height: `${lockedDimensions.height}px`
          } : {
            width: `${containerWidth}px`,
            height: `${containerHeight}px`
          })
        })
      }}
    >
      {/* Header with drag handle - hidden in PiP window */}
      {!isInPiP && (
        <div className={styles.header} onMouseDown={handleMouseDown}>
          <div className={styles.dragHandle}>
            <span className={styles.dragIcon}>⋮⋮</span>
            <span className={styles.title}>
              Student Monitor{students.length > 0 ? ` (${students.length})` : ''}
              {isScreenSharing && <span style={{ fontSize: '10px', marginLeft: '6px', opacity: 0.7 }}>📺</span>}
            </span>
          </div>
          <div className={styles.headerButtons}>
            {!pipWindow && (
              <button
                className={styles.minimizeButton}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  openDocumentPiP();
                }}
                title="Open in Picture-in-Picture window (can move outside browser)"
                style={{ fontSize: '14px' }}
              >
                📺
              </button>
            )}
            {pipWindow && (
              <button
                className={styles.minimizeButton}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  closeDocumentPiP();
                }}
                title="Close Picture-in-Picture window"
                style={{ fontSize: '14px', background: 'rgba(59, 130, 246, 0.3)' }}
              >
                📺
              </button>
            )}
            {!isScreenSharing && (
              <button
                className={styles.minimizeButton}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  // If PiP window is open, close it and return to main window
                  if (pipWindow && !pipWindow.closed) {
                    closeDocumentPiP();
                  } else {
                    // Otherwise, just minimize instead of closing completely
                    setIsMinimized(true);
                  }
                }}
                title="Minimize"
                style={{ fontSize: '14px' }}
              >
                ✕
              </button>
            )}
            <button
              className={styles.minimizeButton}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(true);
              }}
              title="Minimize"
            >
              ➖
            </button>
          </div>
        </div>
      )}

      {/* Student column list */}
      {students.length > 0 ? (
        <div 
          className={styles.studentsColumn}
          style={isInPiP ? {
            height: '100%',
            maxHeight: '100%'
          } : {}}
        >
          {students.map((student) => {
            // Memoize each card to prevent re-renders
            return (
              <ParticipantCard
                key={student.sid}
                student={student}
                onMute={muteParticipant}
                onVideoControl={controlVideo}
                isInPiP={isInPiP}
              />
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.emptyStateTitle}>No participants</div>
          <div className={styles.emptyStateSubtitle}>Participants will appear here when they join the meeting</div>
        </div>
      )}
    </div>
  ), [students.length, isInPiP, isMinimized, position.x, position.y, lockedDimensions?.width, lockedDimensions?.height, containerWidth, containerHeight, isScreenSharing, muteParticipant, controlVideo]);

  // Only show for hosts - check AFTER all hooks are called
  if (!isHost) {
    return null;
  }

  // Render via portal to document.body to escape all parent constraints
  // This ensures it's completely independent of any parent overflow/positioning constraints
  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  // Show toggle button if monitor is not shown - AFTER all hooks
  if (!shouldShow && !isScreenSharing) {
    const toggleButton = (
      <div
        style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          zIndex: 9000,
          background: disabled ? 'rgba(17, 24, 39, 0.5)' : 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '12px 16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          opacity: disabled ? 0.6 : 1
        }}
        onClick={disabled ? undefined : handleManualEnable}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = 'rgba(17, 24, 39, 1)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = 'rgba(17, 24, 39, 0.95)';
          }
        }}
        title={disabled ? "This feature requires an upgrade" : "Show Student Monitor"}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'white',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          <span>👥</span>
          <span>Show Student Monitor{students.length > 0 ? ` (${students.length})` : ''}</span>
          {showProBadge && (
            <span style={{
              padding: '2px 8px',
              background: 'linear-gradient(to right, #a855f7, #ec4899)',
              color: 'white',
              fontSize: '10px',
              fontWeight: 'bold',
              borderRadius: '4px',
              marginLeft: '4px'
            }}>
              PRO
            </span>
          )}
        </div>
      </div>
    );
    return createPortal(toggleButton, document.body);
  }

  // Don't show if conditions not met or feature is disabled - AFTER all hooks
  if (!shouldShow || disabled) {
    return null;
  }

  // Handle minimized state - AFTER all hooks
  if (isMinimized) {
    const minimizedContainer = (
      <div
        ref={containerRef}
        className={styles.container}
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          width: '200px',
          height: '40px',
          cursor: 'pointer',
          zIndex: 999999,
          ...(lockedDimensions && {
            width: `${lockedDimensions.width}px`,
            height: `${lockedDimensions.height}px`
          })
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsMinimized(false);
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(17, 24, 39, 1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(17, 24, 39, 0.95)';
        }}
        title="Click to expand Student Monitor"
      >
        <div 
          className={styles.minimizedBar}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            height: '100%',
            width: '100%'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={styles.minimizedIcon}>👥</span>
            <span className={styles.minimizedText}>
              {students.length > 0 
                ? `${students.length} Student${students.length !== 1 ? 's' : ''}`
                : 'Student Monitor'}
            </span>
          </div>
          <button
            className={styles.expandButton}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(false);
            }}
            title="Expand"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px'
            }}
          >
            ⬆️
          </button>
        </div>
      </div>
    );
    return createPortal(minimizedContainer, document.body);
  }

  // If PiP window is open and valid, render to PiP window instead
  if (pipWindow && !pipWindow.closed && pipWindow.document && pipWindow.document.body) {
    return createPortal(mainContainer, pipWindow.document.body);
  }

  // Verify portal target exists
  const portalTarget = document.body;
  if (!portalTarget) {
    return null;
  }

  return createPortal(mainContainer, portalTarget);
}

// Export memoized component to prevent re-renders from parent
export const StudentMonitorPiP = React.memo(StudentMonitorPiPComponent, (prevProps, nextProps) => {
  // Only re-render if props actually change
  return prevProps.isHost === nextProps.isHost &&
         prevProps.disabled === nextProps.disabled &&
         prevProps.showProBadge === nextProps.showProBadge &&
         prevProps.roomName === nextProps.roomName;
});

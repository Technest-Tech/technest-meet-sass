'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRoomContext, useLocalParticipant, useParticipants, VideoTrack } from '@livekit/components-react';
import { Track, TrackPublication } from 'livekit-client';
import styles from '@/styles/StudentMonitorPiP.module.css';

interface Position {
  x: number;
  y: number;
}

interface StudentMonitorPiPProps {
  isHost?: boolean;
  disabled?: boolean;
  showProBadge?: boolean;
}

export function StudentMonitorPiP({ isHost = false, disabled = false, showProBadge = false }: StudentMonitorPiPProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
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
  
  // Load persisted state on mount
  useEffect(() => {
    const persisted = sessionStorage.getItem(STORAGE_KEY);
    if (persisted === 'true') {
      manualEnableRef.current = true;
      setIsManuallyEnabled(true);
      console.log('Restored manual enable state from sessionStorage');
    }
    
    const minimized = sessionStorage.getItem(MINIMIZED_KEY);
    if (minimized === 'true') {
      setIsMinimized(true);
      console.log('Restored minimized state from sessionStorage');
    }
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

  // Only show for hosts
  if (!isHost) {
    return null;
  }

  // Filter students (remote participants with camera)
  const students = participants.filter(participant => {
    try {
      const cameraTrack = participant.getTrackPublication(Track.Source.Camera);
      return cameraTrack?.isEnabled && !!cameraTrack?.track;
    } catch {
      return false;
    }
  });

  // Handle manual enable
  const handleManualEnable = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    manualEnableRef.current = true;
    setIsManuallyEnabled(true);
    sessionStorage.setItem(STORAGE_KEY, 'true');
  }, []);

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
        const pip = await (window as any).documentPictureInPicture.requestWindow({
          width: 600,
          height: 400,
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
        pip.document.body.style.display = 'flex';
        pip.document.body.style.alignItems = 'center';
        pip.document.body.style.justifyContent = 'center';
        
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

  // Show if screen sharing OR manually enabled
  const persistedEnabled = typeof window !== 'undefined' && sessionStorage.getItem(STORAGE_KEY) === 'true';
  const shouldShow = (isScreenSharing || isManuallyEnabled || manualEnableRef.current || persistedEnabled);

  // Show toggle button if monitor is not shown
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
    return mounted && typeof document !== 'undefined' ? createPortal(toggleButton, document.body) : null;
  }

  // Don't show if conditions not met or feature is disabled
  if (!shouldShow || disabled) {
    return null;
  }

  // Calculate optimal layout based on student count
  const calculateLayout = (count: number) => {
    const headerHeight = 60; // Approximate header height
    const padding = 16; // Container padding
    const gap = 12; // Grid gap
    const minCardWidth = 200;
    const minCardHeight = 150;
    const maxCardWidth = 600;
    const maxCardHeight = 400;
    
    // Calculate available viewport space (with some margin)
    // Use windowSize state if available, otherwise fall back to window dimensions
    const viewportWidth = windowSize.width > 0 ? windowSize.width : (typeof window !== 'undefined' ? window.innerWidth : 1920);
    const viewportHeight = windowSize.height > 0 ? windowSize.height : (typeof window !== 'undefined' ? window.innerHeight : 1080);
    const maxWidth = Math.min(viewportWidth * 0.9, 1200);
    const maxHeight = Math.min(viewportHeight * 0.85, 800);
    
    let columns = 1;
    let rows = 1;
    let containerWidth = minCardWidth + padding * 2;
    let containerHeight = minCardHeight + headerHeight + padding * 2;
    
    if (count === 0) {
      return {
        columns: 1,
        rows: 1,
        gridTemplateColumns: '1fr',
        gridTemplateRows: '1fr',
        containerWidth: 400,
        containerHeight: 300,
        cardAspectRatio: '16/9'
      };
    }
    
    if (count === 1) {
      // Single student: use ~95% of available space
      const cardWidth = Math.min(maxWidth - padding * 2, maxCardWidth);
      const cardHeight = Math.min(maxHeight - headerHeight - padding * 2, maxCardHeight);
      return {
        columns: 1,
        rows: 1,
        gridTemplateColumns: '1fr',
        gridTemplateRows: '1fr',
        containerWidth: cardWidth + padding * 2,
        containerHeight: cardHeight + headerHeight + padding * 2,
        cardAspectRatio: '16/9'
      };
    }
    
    if (count === 2) {
      // 2 students: split evenly (2 columns, 1 row)
      const cardWidth = Math.min((maxWidth - padding * 2 - gap) / 2, maxCardWidth);
      const cardHeight = Math.min(maxHeight - headerHeight - padding * 2, maxCardHeight);
      return {
        columns: 2,
        rows: 1,
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr',
        containerWidth: cardWidth * 2 + gap + padding * 2,
        containerHeight: cardHeight + headerHeight + padding * 2,
        cardAspectRatio: '16/9'
      };
    }
    
    if (count === 3) {
      // 3 students: 2 on top, 1 on bottom (or 1 on left, 2 stacked on right)
      // Use layout: 1 column on left, 2 rows on right
      const cardWidth = Math.min((maxWidth - padding * 2 - gap * 2) / 3, maxCardWidth);
      const cardHeight = Math.min((maxHeight - headerHeight - padding * 2 - gap) / 2, maxCardHeight);
      return {
        columns: 2,
        rows: 2,
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        containerWidth: cardWidth * 2 + gap + padding * 2,
        containerHeight: cardHeight * 2 + gap + headerHeight + padding * 2,
        cardAspectRatio: '16/9',
        specialLayout: 'three' // Special handling for 3 students
      };
    }
    
    if (count === 4) {
      // 4 students: 2x2 grid
      const cardWidth = Math.min((maxWidth - padding * 2 - gap) / 2, maxCardWidth);
      const cardHeight = Math.min((maxHeight - headerHeight - padding * 2 - gap) / 2, maxCardHeight);
      return {
        columns: 2,
        rows: 2,
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        containerWidth: cardWidth * 2 + gap + padding * 2,
        containerHeight: cardHeight * 2 + gap + headerHeight + padding * 2,
        cardAspectRatio: '16/9'
      };
    }
    
    if (count <= 6) {
      // 5-6 students: 3 columns, 2 rows
      const cardWidth = Math.min((maxWidth - padding * 2 - gap * 2) / 3, maxCardWidth);
      const cardHeight = Math.min((maxHeight - headerHeight - padding * 2 - gap) / 2, maxCardHeight);
      return {
        columns: 3,
        rows: 2,
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        containerWidth: cardWidth * 3 + gap * 2 + padding * 2,
        containerHeight: cardHeight * 2 + gap + headerHeight + padding * 2,
        cardAspectRatio: '16/9'
      };
    }
    
    if (count <= 9) {
      // 7-9 students: 3x3 grid
      const cardWidth = Math.min((maxWidth - padding * 2 - gap * 2) / 3, maxCardWidth);
      const cardHeight = Math.min((maxHeight - headerHeight - padding * 2 - gap * 2) / 3, maxCardHeight);
      return {
        columns: 3,
        rows: 3,
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        containerWidth: cardWidth * 3 + gap * 2 + padding * 2,
        containerHeight: cardHeight * 3 + gap * 2 + headerHeight + padding * 2,
        cardAspectRatio: '16/9'
      };
    }
    
    // 10+ students: 4 columns with scrolling
    const cardWidth = Math.min((maxWidth - padding * 2 - gap * 3) / 4, maxCardWidth);
    const cardHeight = Math.min((maxHeight - headerHeight - padding * 2 - gap * 2) / 3, maxCardHeight);
    return {
      columns: 4,
      rows: 3,
      gridTemplateColumns: 'repeat(4, 1fr)',
      gridTemplateRows: 'repeat(auto-fit, minmax(150px, 1fr))',
      containerWidth: cardWidth * 4 + gap * 3 + padding * 2,
      containerHeight: Math.min(cardHeight * 3 + gap * 2 + headerHeight + padding * 2, maxHeight),
      cardAspectRatio: '16/9',
      scrollable: true
    };
  };
  
  const layout = calculateLayout(students.length);

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
    return mounted && typeof document !== 'undefined' ? createPortal(minimizedContainer, document.body) : null;
  }

  const mainContainer = (
    <div
      ref={containerRef}
      className={styles.container}
      style={{
        // Use transform like PictureInPicture - base position set in CSS
        transform: `translate(${position.x}px, ${position.y}px)`,
        // Apply calculated dimensions or locked dimensions during drag
        ...(lockedDimensions ? {
          width: `${lockedDimensions.width}px`,
          height: `${lockedDimensions.height}px`
        } : {
          width: `${layout.containerWidth}px`,
          height: `${layout.containerHeight}px`
        })
      }}
    >
      {/* Header with drag handle */}
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

      {/* Student grid */}
      {students.length > 0 ? (
        <div
          className={styles.studentsGrid}
          style={{
            gridTemplateColumns: layout.gridTemplateColumns,
            gridTemplateRows: layout.gridTemplateRows,
            maxHeight: layout.scrollable ? `${layout.containerHeight - 60 - 32}px` : 'none',
            overflowY: layout.scrollable ? 'auto' : 'visible'
          }}
        >
          {students.map((student, index) => {
            const cameraTrack = student.getTrackPublication(Track.Source.Camera);
            const audioTrack = student.getTrackPublication(Track.Source.Microphone);
            const isMuted = !audioTrack?.isEnabled || audioTrack?.isMuted;
            
            // Special handling for 3 students layout
            const gridStyle: React.CSSProperties = {};
            if (layout.specialLayout === 'three' && index === 0) {
              // First student spans 2 rows on the left
              gridStyle.gridRow = 'span 2';
            } else if (layout.specialLayout === 'three' && index === 1) {
              // Second student in top right
              gridStyle.gridColumn = '2';
              gridStyle.gridRow = '1';
            } else if (layout.specialLayout === 'three' && index === 2) {
              // Third student in bottom right
              gridStyle.gridColumn = '2';
              gridStyle.gridRow = '2';
            }

            return (
              <div 
                key={student.sid} 
                className={styles.studentCard}
                style={gridStyle}
              >
                {cameraTrack?.track ? (
                  <div className={styles.videoContainer}>
                    <VideoTrack
                      trackRef={{
                        participant: student,
                        publication: cameraTrack,
                        source: Track.Source.Camera
                      }}
                      className={styles.studentVideo}
                    />
                    {isMuted && (
                      <div className={styles.muteIndicator} title="Muted">
                        🔇
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.placeholder}>
                    <div className={styles.placeholderInitial}>
                      {student.identity.charAt(0).toUpperCase()}
                    </div>
                    {isMuted && (
                      <div className={styles.muteIndicator} title="Muted">
                        🔇
                      </div>
                    )}
                  </div>
                )}
                <div className={styles.studentName} title={student.identity}>
                  {student.identity.length > 12
                    ? `${student.identity.substring(0, 12)}...`
                    : student.identity}
                </div>
              </div>
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
          <div className={styles.emptyStateTitle}>No students with cameras active</div>
          <div className={styles.emptyStateSubtitle}>Student videos will appear here when they enable their cameras</div>
        </div>
      )}
    </div>
  );

  // Render via portal to document.body to escape all parent constraints
  // This ensures it's completely independent of any parent overflow/positioning constraints
  if (!mounted || typeof document === 'undefined') {
    console.log('StudentMonitor: Not mounted or document undefined');
    return null;
  }

  // If PiP window is open and valid, render to PiP window instead
  if (pipWindow && !pipWindow.closed && pipWindow.document && pipWindow.document.body) {
    console.log('StudentMonitor: Rendering to PiP window');
    return createPortal(mainContainer, pipWindow.document.body);
  }

  // Verify portal target exists
  const portalTarget = document.body;
  if (!portalTarget) {
    console.error('Student Monitor PiP: document.body not available for portal');
    return null;
  }

  console.log('StudentMonitor: Rendering to main document.body');
  return createPortal(mainContainer, portalTarget);
}

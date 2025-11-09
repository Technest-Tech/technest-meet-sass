'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useRoomContext, useLocalParticipant, useRemoteParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { ScreenAnnotationData, DrawingStroke, DrawingPoint } from '@/lib/types';
import styles from '@/styles/ScreenAnnotation.module.css';

interface ScreenAnnotationProps {
  isEnabled: boolean;
  onClose: () => void;
}

const COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
const BRUSH_SIZES = [2, 4, 8];

export function ScreenAnnotation({ isEnabled, onClose }: ScreenAnnotationProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'pointer'>('pen');
  const [currentColor, setCurrentColor] = useState('#FF0000');
  const [currentWidth, setCurrentWidth] = useState(4);
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [pointers, setPointers] = useState<Map<string, { x: number; y: number }>>(new Map());
  
  // Check if there's an active screen share
  const [hasScreenShare, setHasScreenShare] = useState(false);
  const [screenShareVideo, setScreenShareVideo] = useState<HTMLVideoElement | null>(null);
  
  // Find and track the screen share video element
  useEffect(() => {
    if (!isEnabled || !room) return;
    
    const findScreenShareVideo = () => {
      // Check local participant
      const localScreenTrack = Array.from(localParticipant.videoTrackPublications.values())
        .find(pub => pub.source === Track.Source.ScreenShare);
      
      // Check remote participants
      const remoteScreenTrack = remoteParticipants.some(participant =>
        Array.from(participant.videoTrackPublications.values())
          .some(pub => pub.source === Track.Source.ScreenShare)
      );
      
      const hasScreen = !!(localScreenTrack || remoteScreenTrack);
      setHasScreenShare(hasScreen);
      
      if (!hasScreen) {
        setScreenShareVideo(null);
        return;
      }
      
      // Find the screen share video element in the DOM
      const videoElements = document.querySelectorAll('video');
      let foundVideo: HTMLVideoElement | null = null;
      
      for (const video of videoElements) {
        // Look for video elements that are likely screen shares
        // They're usually larger and in focus position
        const rect = video.getBoundingClientRect();
        
        // Screen share videos are typically larger (at least 400px)
        if (rect.width > 400 && rect.height > 300) {
          // Check if it's actually playing screen share content
          const parent = video.closest('[data-lk-source="screen_share"]');
          const hasScreenShareClass = video.className.includes('screen') || 
                                      parent !== null ||
                                      video.parentElement?.className.includes('screen');
          
          // If explicitly marked or is the largest video, use it
          if (hasScreenShareClass || !foundVideo || rect.width > foundVideo.getBoundingClientRect().width) {
            foundVideo = video;
          }
        }
      }
      
      if (foundVideo && foundVideo !== screenShareVideo) {
        setScreenShareVideo(foundVideo);
      }
    };
    
    findScreenShareVideo();
    
    // Re-check periodically as layout changes
    const interval = setInterval(findScreenShareVideo, 500);
    
    return () => clearInterval(interval);
  }, [isEnabled, room, localParticipant, remoteParticipants, screenShareVideo]);

  // Handle incoming annotation data
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (data: Uint8Array, participant?: any) => {
      try {
        const messageString = new TextDecoder().decode(data);
        const messageData = JSON.parse(messageString);
        
        if (messageData.type === 'screen_annotation_stroke' &&
            participant?.identity !== localParticipant?.identity) {
          const annotationData = messageData as ScreenAnnotationData;
          if (annotationData.stroke) {
            setStrokes(prev => [...prev, annotationData.stroke!]);
          }
        } else if (messageData.type === 'screen_annotation_clear' &&
                   participant?.identity !== localParticipant?.identity) {
          setStrokes([]);
        } else if (messageData.type === 'screen_pointer_position' &&
                   participant?.identity !== localParticipant?.identity) {
          const annotationData = messageData as ScreenAnnotationData;
          if (annotationData.position) {
            setPointers(prev => {
              const newPointers = new Map(prev);
              newPointers.set(annotationData.sender, annotationData.position!);
              return newPointers;
            });
            
            // Remove pointer after 2 seconds
            setTimeout(() => {
              setPointers(prev => {
                const newPointers = new Map(prev);
                newPointers.delete(annotationData.sender);
                return newPointers;
              });
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Error parsing screen annotation data:', error);
      }
    };

    room.on('dataReceived', handleDataReceived);
    
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, localParticipant]);

  // Define redrawCanvas before it's used in useEffects
  const redrawCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all completed strokes with normalized coordinates
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.8;
      
      // Convert normalized coordinates (0-1) to pixel coordinates
      const firstPoint = stroke.points[0];
      ctx.moveTo(firstPoint.x * canvas.width, firstPoint.y * canvas.height);
      
      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i];
        ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
      }
      
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    });
    
    // Draw current stroke if drawing
    if (currentStroke && currentStroke.points.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = currentStroke.color;
      ctx.lineWidth = currentStroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.8;
      
      const firstPoint = currentStroke.points[0];
      ctx.moveTo(firstPoint.x * canvas.width, firstPoint.y * canvas.height);
      
      for (let i = 1; i < currentStroke.points.length; i++) {
        const point = currentStroke.points[i];
        ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
      }
      
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
    
    // Draw pointers with normalized coordinates
    pointers.forEach((pos, sender) => {
      const pixelX = pos.x * canvas.width;
      const pixelY = pos.y * canvas.height;
      
      ctx.beginPath();
      ctx.arc(pixelX, pixelY, 10, 0, 2 * Math.PI);
      ctx.fillStyle = '#FF0000';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw sender name
      ctx.font = '14px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(sender, pixelX + 15, pixelY + 5);
      ctx.fillText(sender, pixelX + 15, pixelY + 5);
    });
  }, [strokes, currentStroke, pointers]);

  // Position canvas to match screen share video
  useEffect(() => {
    if (!canvasRef.current || !screenShareVideo || !isEnabled) return;
    
    const updateCanvasPosition = () => {
      if (!canvasRef.current || !screenShareVideo) return;
      
      const rect = screenShareVideo.getBoundingClientRect();
      const canvas = canvasRef.current;
      
      // Position canvas over the video
      canvas.style.position = 'fixed';
      canvas.style.top = `${rect.top}px`;
      canvas.style.left = `${rect.left}px`;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      redrawCanvas();
    };
    
    updateCanvasPosition();
    
    // Update on resize, scroll, and video size changes
    window.addEventListener('resize', updateCanvasPosition);
    window.addEventListener('scroll', updateCanvasPosition, true);
    
    // Use ResizeObserver for video element size changes
    const resizeObserver = new ResizeObserver(updateCanvasPosition);
    resizeObserver.observe(screenShareVideo);
    
    // Also observe parent containers that might affect position
    let parent = screenShareVideo.parentElement;
    while (parent) {
      resizeObserver.observe(parent);
      parent = parent.parentElement;
    }
    
    return () => {
      window.removeEventListener('resize', updateCanvasPosition);
      window.removeEventListener('scroll', updateCanvasPosition, true);
      resizeObserver.disconnect();
    };
  }, [screenShareVideo, isEnabled, redrawCanvas]);

  // Redraw canvas when strokes change
  useEffect(() => {
    if (isEnabled) {
      redrawCanvas();
    }
  }, [strokes, currentStroke, pointers, isEnabled, redrawCanvas]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): DrawingPoint => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    // Use normalized coordinates (0-1 range) for better cross-device sync
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    
    if (currentTool === 'pointer') {
      // Send pointer position
      sendPointerPosition(pos);
      return;
    }
    
    setIsDrawing(true);
    
    const newStroke: DrawingStroke = {
      id: `${Date.now()}-${Math.random()}`,
      points: [pos],
      color: currentColor,
      width: currentWidth,
      tool: currentTool,
    };
    
    setCurrentStroke(newStroke);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStroke || currentTool === 'pointer') return;
    
    const pos = getMousePos(e);
    const updatedStroke = {
      ...currentStroke,
      points: [...currentStroke.points, pos],
    };
    
    setCurrentStroke(updatedStroke);
  };

  const stopDrawing = async () => {
    if (!currentStroke || !localParticipant || currentTool === 'pointer') return;
    
    setIsDrawing(false);
    
    // Add stroke to list
    setStrokes(prev => [...prev, currentStroke]);
    
    // Broadcast stroke to other participants
    const annotationData: ScreenAnnotationData = {
      type: 'screen_annotation_stroke',
      stroke: currentStroke,
      sender: localParticipant.identity,
      timestamp: Date.now(),
      id: currentStroke.id,
    };
    
    const encodedData = new TextEncoder().encode(JSON.stringify(annotationData));
    await room.localParticipant.publishData(encodedData, { topic: 'screen-annotation' });
    
    setCurrentStroke(null);
  };

  const sendPointerPosition = async (pos: DrawingPoint) => {
    if (!localParticipant) return;
    
    const annotationData: ScreenAnnotationData = {
      type: 'screen_pointer_position',
      position: { x: pos.x, y: pos.y },
      sender: localParticipant.identity,
      timestamp: Date.now(),
      id: `pointer-${Date.now()}`,
    };
    
    const encodedData = new TextEncoder().encode(JSON.stringify(annotationData));
    await room.localParticipant.publishData(encodedData, { topic: 'screen-annotation' });
    
    // Show local pointer
    if (localParticipant.identity) {
      setPointers(prev => {
        const newPointers = new Map(prev);
        newPointers.set(localParticipant.identity, pos);
        return newPointers;
      });
      
      setTimeout(() => {
        setPointers(prev => {
          const newPointers = new Map(prev);
          newPointers.delete(localParticipant.identity);
          return newPointers;
        });
      }, 2000);
    }
  };

  const clearAnnotations = async () => {
    if (!localParticipant) return;
    
    setStrokes([]);
    setPointers(new Map());
    
    // Broadcast clear to other participants
    const annotationData: ScreenAnnotationData = {
      type: 'screen_annotation_clear',
      sender: localParticipant.identity,
      timestamp: Date.now(),
      id: `clear-${Date.now()}`,
    };
    
    const encodedData = new TextEncoder().encode(JSON.stringify(annotationData));
    await room.localParticipant.publishData(encodedData, { topic: 'screen-annotation' });
  };

  if (!isEnabled) return null;

  // Show warning if no screen share is active
  if (!hasScreenShare) {
    return (
      <div className={styles.warningOverlay}>
        <div className={styles.warningBox}>
          <h3>⚠️ No Screen Share Active</h3>
          <p>Screen annotation requires an active screen share.</p>
          <p>Please start screen sharing first.</p>
          <button onClick={onClose} className={styles.closeWarningButton}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Annotation Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className={styles.annotationOverlay}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <button
            onClick={() => setCurrentTool('pen')}
            className={`${styles.toolButton} ${currentTool === 'pen' ? styles.active : ''}`}
            title="Pen"
          >
            ✏️
          </button>
          <button
            onClick={() => setCurrentTool('pointer')}
            className={`${styles.toolButton} ${currentTool === 'pointer' ? styles.active : ''}`}
            title="Pointer"
          >
            👆
          </button>
        </div>

        {currentTool === 'pen' && (
          <>
            <div className={styles.toolGroup}>
              {COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setCurrentColor(color)}
                  className={`${styles.colorButton} ${currentColor === color ? styles.active : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className={styles.toolGroup}>
              {BRUSH_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => setCurrentWidth(size)}
                  className={`${styles.sizeButton} ${currentWidth === size ? styles.active : ''}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </>
        )}

        <div className={styles.toolGroup}>
          <button onClick={clearAnnotations} className={styles.toolButton} title="Clear">
            🗑️
          </button>
          <button onClick={onClose} className={styles.closeButton} title="Close">
            ✕
          </button>
        </div>
      </div>
    </>
  );
}


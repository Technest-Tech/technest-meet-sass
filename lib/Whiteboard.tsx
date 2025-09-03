'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { DataPacket_Kind } from 'livekit-client';
import styles from '../styles/Whiteboard.module.css';

interface DrawingPoint {
  x: number;
  y: number;
  pressure?: number;
}

interface DrawingStroke {
  id: string;
  points: DrawingPoint[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
}

interface WhiteboardProps {
  isOpen: boolean;
  onClose: () => void;
  isHost: boolean;
  onHostToggle?: (isOpen: boolean) => void; // Callback for host to control all participants
}

const COLORS = [
  '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
  '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000'
];

const BRUSH_SIZES = [2, 4, 6, 8, 12, 16, 20];

export function Whiteboard({ isOpen, onClose, isHost, onHostToggle }: WhiteboardProps) {
  const room = useRoomContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentWidth, setCurrentWidth] = useState(4);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [localStrokes, setLocalStrokes] = useState<DrawingStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);
  const [participantId, setParticipantId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  
  // Throttle real-time updates to prevent overwhelming the data channel
  const lastUpdateTime = useRef<number>(0);
  const UPDATE_THROTTLE_MS = 50; // Send updates every 50ms max
  
  // Debounce stroke updates to prevent excessive re-renders
  const debouncedStrokeUpdate = useRef<NodeJS.Timeout | null>(null);
  
  // Animation frame for smooth drawing
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (room?.localParticipant) {
      setParticipantId(room.localParticipant.identity);
      setIsConnected(true);
    }
  }, [room]);

  // Handle incoming whiteboard data from other participants
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        
        // Debug: Log all incoming data
        console.log('Received data:', {
          type: data.type,
          from: participant.identity,
          to: participantId,
          isHost: data.isHost
        });
        
        if (data.type === 'stroke' && participant.identity !== participantId) {
          // Add stroke from other participant
          console.log('Adding completed stroke from:', participant.identity);
          setStrokes(prev => [...prev, data.stroke]);
        } else if (data.type === 'stroke_update' && participant.identity !== participantId) {
          // Real-time stroke update from other participant
          console.log('Real-time stroke update from:', participant.identity, 'points:', data.stroke.points.length);
          
          // Debug: Check if this is the host receiving from a participant
          console.log('Host receiving from participant:', {
            isHost: participantId.includes('host') || participantId.includes('Host'),
            participantIdentity: participant.identity,
            currentParticipantId: participantId
          });
          
          // Debounce stroke updates to prevent excessive re-renders
          if (debouncedStrokeUpdate.current) {
            clearTimeout(debouncedStrokeUpdate.current);
          }
          
          debouncedStrokeUpdate.current = setTimeout(() => {
            setStrokes(prev => {
              const updatedStrokes = [...prev];
              const existingIndex = updatedStrokes.findIndex(s => s.id === data.stroke.id);
              
              if (existingIndex >= 0) {
                // Update existing stroke
                updatedStrokes[existingIndex] = data.stroke;
              } else {
                // Add new stroke
                updatedStrokes.push(data.stroke);
              }
              
              return updatedStrokes;
            });
          }, 16); // 60fps update rate
        } else if (data.type === 'clear' && participant.identity !== participantId) {
          // Clear whiteboard from other participant
          console.log('Clear command from:', participant.identity);
          setStrokes([]);
          setLocalStrokes([]);
        } else if (data.type === 'whiteboard_toggle' && participant.identity !== participantId) {
          // Host is controlling whiteboard state for all participants
          console.log('Whiteboard toggle from:', participant.identity, 'action:', data.action);
          
          if (data.isHost && data.action === 'open') {
            // Host opened whiteboard for everyone
            if (onHostToggle) {
              onHostToggle(true);
            }
          } else if (data.isHost && data.action === 'close') {
            // Host closed whiteboard for everyone
            if (onHostToggle) {
              onHostToggle(false);
            }
          }
        }
      } catch (error) {
        console.error('Error parsing whiteboard data:', error);
      }
    };

    // Subscribe to data channel messages
    room.on('dataReceived', handleDataReceived);
    
    // Debug: Log when data channel is set up
    console.log('Data channel listener set up for participant:', participantId);
    console.log('Room state:', room.state);
    console.log('Local participant:', room.localParticipant?.identity);
    
    return () => {
      room.off('dataReceived', handleDataReceived);
      console.log('Data channel listener removed for participant:', participantId);
    };
  }, [room, participantId, onHostToggle]);

  // Cleanup effect for debounced updates and animation frames
  useEffect(() => {
    return () => {
      if (debouncedStrokeUpdate.current) {
        clearTimeout(debouncedStrokeUpdate.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Send data to other participants
  const sendDataToParticipants = useCallback((data: any) => {
    if (!room) return;
    
    try {
      console.log('Sending data:', {
        type: data.type,
        from: participantId,
        to: 'all participants'
      });
      
      const encodedData = new TextEncoder().encode(JSON.stringify(data));
      
      // Try to publish data with topic for better organization
      try {
        room.localParticipant.publishData(encodedData, {
          topic: 'whiteboard'
        });
        console.log('Data sent successfully with topic');
      } catch (topicError) {
        // Fallback to publishing without topic
        console.log('Falling back to publishing without topic');
        room.localParticipant.publishData(encodedData);
        console.log('Data sent successfully without topic');
      }
    } catch (error) {
      console.error('Error sending whiteboard data:', error);
    }
  }, [room, participantId]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || !isOpen) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // Redraw all strokes
      redrawCanvas();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [isOpen]);

  // Redraw canvas with all strokes
  const redrawCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all completed strokes
    [...strokes, ...localStrokes].forEach(stroke => {
      if (stroke.points.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const firstPoint = stroke.points[0];
      ctx.moveTo(firstPoint.x, firstPoint.y);

      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i];
        ctx.lineTo(point.x, point.y);
      }

      ctx.stroke();
    });

    // Draw current stroke in real-time (if drawing)
    if (currentStroke && currentStroke.points.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = currentStroke.tool === 'eraser' ? '#ffffff' : currentStroke.color;
      ctx.lineWidth = currentStroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const firstPoint = currentStroke.points[0];
      ctx.moveTo(firstPoint.x, firstPoint.y);

      for (let i = 1; i < currentStroke.points.length; i++) {
        const point = currentStroke.points[i];
        ctx.lineTo(point.x, point.y);
      }

      ctx.stroke();
    }
  }, [strokes, localStrokes, currentStroke]);

  // Redraw when strokes change or when drawing
  useEffect(() => {
    redrawCanvas();
  }, [strokes, localStrokes, redrawCanvas]);

  // Smooth real-time drawing with requestAnimationFrame
  useEffect(() => {
    if (isDrawing && currentStroke) {
      const animate = () => {
        redrawCanvas();
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animationFrameRef.current = requestAnimationFrame(animate);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDrawing, currentStroke, redrawCanvas]);

  // Mouse event handlers
  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isOpen) return;
    
    setIsDrawing(true);
    const pos = getMousePos(e);
    
    const newStroke: DrawingStroke = {
      id: `${Date.now()}-${Math.random()}`,
      points: [pos],
      color: currentTool === 'eraser' ? '#ffffff' : currentColor,
      width: currentWidth,
      tool: currentTool
    };
    
    setCurrentStroke(newStroke);
    
    // Force immediate redraw to show the starting point
    setTimeout(() => redrawCanvas(), 0);
  }, [isOpen, getMousePos, currentColor, currentWidth, currentTool, redrawCanvas]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStroke || !isOpen) return;
    
    const pos = getMousePos(e);
    const updatedStroke = {
      ...currentStroke,
      points: [...currentStroke.points, pos]
    };
    
    setCurrentStroke(updatedStroke);
    
    // Update local strokes for immediate visual feedback
    setLocalStrokes(prev => 
      prev.map(stroke => 
        stroke.id === currentStroke.id ? updatedStroke : stroke
      )
    );
    
    // Send real-time stroke update to other participants (throttled)
    const now = Date.now();
    if (now - lastUpdateTime.current >= UPDATE_THROTTLE_MS) {
      const message = {
        type: 'stroke_update',
        stroke: updatedStroke
      };
      sendDataToParticipants(message);
      lastUpdateTime.current = now;
    }
  }, [isDrawing, currentStroke, isOpen, getMousePos, sendDataToParticipants]);

  const stopDrawing = useCallback(() => {
    if (!currentStroke || !isOpen) return;
    
    setIsDrawing(false);
    
    // Add completed stroke to local strokes
    setLocalStrokes(prev => [...prev, currentStroke]);
    
    // Send stroke to other participants via LiveKit data channel
    const message = {
      type: 'stroke',
      stroke: currentStroke
    };
    sendDataToParticipants(message);
    
    setCurrentStroke(null);
  }, [currentStroke, isOpen, sendDataToParticipants]);

  const clearWhiteboard = useCallback(() => {
    setStrokes([]);
    setLocalStrokes([]);
    
    // Send clear command to other participants
    const message = { type: 'clear' };
    sendDataToParticipants(message);
  }, [sendDataToParticipants]);

  const downloadWhiteboard = useCallback(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `whiteboard-${new Date().toISOString().slice(0, 19)}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }, []);

  if (!isOpen) return null;

  return (
    <div className={styles.whiteboardOverlay}>
      <div className={styles.whiteboardContainer}>
        {/* Compact Header */}
        <div className={styles.whiteboardHeader}>
          <div className={styles.headerTitle}>
            <h2 className={styles.whiteboardTitle}>Collaborative Whiteboard</h2>
            {!isHost && (
              <div className={styles.hostControlIndicator}>
                <span className={styles.hostControlText}>👑 Controlled by Host</span>
              </div>
            )}
          </div>
          <div className={styles.headerButtons}>
            <button
              onClick={downloadWhiteboard}
              className={`${styles.headerButton} ${styles.downloadButton}`}
              title="Download whiteboard as image"
            >
              💾
            </button>
            <button
              onClick={clearWhiteboard}
              className={`${styles.headerButton} ${styles.clearButton}`}
              title="Clear whiteboard"
            >
              🗑️
            </button>
            <button
              onClick={onClose}
              className={`${styles.headerButton} ${styles.closeButton}`}
              title="Close whiteboard"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Compact Toolbar */}
        <div className={styles.whiteboardToolbar}>
          {/* Tool Selection */}
          <div className={styles.toolGroup}>
            <button
              onClick={() => setCurrentTool('pen')}
              className={`${styles.toolButton} ${styles.toolButtonIcon} ${
                currentTool === 'pen' ? styles.active : ''
              }`}
              title="Pen Tool"
            >
              ✏️
            </button>
            <button
              onClick={() => setCurrentTool('eraser')}
              className={`${styles.toolButton} ${styles.toolButtonIcon} ${
                currentTool === 'eraser' ? styles.active : ''
              }`}
              title="Eraser Tool"
            >
              🧽
            </button>
          </div>

          {/* Color Selection */}
          <div className={styles.toolGroup}>
            <div className={styles.colorPalette}>
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setCurrentColor(color)}
                  className={`${styles.colorButton} ${
                    currentColor === color ? styles.active : ''
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Brush Size */}
          <div className={styles.toolGroup}>
            <div className={styles.sizeButtons}>
              {BRUSH_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setCurrentWidth(size)}
                  className={`${styles.sizeButton} ${
                    currentWidth === size ? styles.active : ''
                  }`}
                  title={`Brush size: ${size}px`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Status Indicator */}
          <div className={styles.statusIndicator}>
            <div className={`${styles.statusDot} ${
              isConnected ? styles.connected : styles.disconnected
            }`} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        {/* Canvas */}
        <div className={styles.whiteboardCanvas}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={(e) => {
              e.preventDefault();
              const touch = e.touches[0];
              const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
              });
              startDrawing(mouseEvent as any);
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              const touch = e.touches[0];
              const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
              });
              draw(mouseEvent as any);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              stopDrawing();
            }}
          />
        </div>

        {/* Compact Footer */}
        <div className={styles.whiteboardFooter}>
          <div className={styles.footerContent}>
            <div className={styles.footerInfo}>
              <span>
                {isHost ? '👑' : '👤'} • 
                {currentTool === 'pen' ? '✏️' : '🧽'} • 
                <span className={styles.colorIndicator} style={{ backgroundColor: currentColor }}></span> • 
                {currentWidth}px
                {isDrawing && (
                  <span className={styles.drawingIndicator}> • ✏️</span>
                )}
              </span>
            </div>
            <div className={styles.footerInfo}>
              <span>
                {strokes.length + localStrokes.length} strokes • 
                {room?.numParticipants || 1} participants
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

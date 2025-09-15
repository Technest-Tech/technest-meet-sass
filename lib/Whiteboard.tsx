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

interface WhiteboardImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

interface WhiteboardProps {
  isOpen: boolean;
  onClose: () => void;
  isHost: boolean;
  onHostToggle?: (isOpen: boolean) => void; // Callback for host to control all participants
}

const COLORS = [
  '#000000', '#FF0000'
];

const BRUSH_SIZES = [2, 8];

export function Whiteboard({ isOpen, onClose, isHost, onHostToggle }: WhiteboardProps) {
  const room = useRoomContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentWidth, setCurrentWidth] = useState(4);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');
  const [currentMode, setCurrentMode] = useState<'draw' | 'move'>('draw');
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [localStrokes, setLocalStrokes] = useState<DrawingStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);
  const [participantId, setParticipantId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [images, setImages] = useState<WhiteboardImage[]>([]);
  const [localImages, setLocalImages] = useState<WhiteboardImage[]>([]);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  
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
          setImages([]);
          setLocalImages([]);
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
        } else if (data.type === 'image_add' && participant.identity !== participantId) {
          // Add image from other participant
          console.log('Adding image from:', participant.identity, {
            imageId: data.image?.id,
            imageSize: data.image?.src?.length,
            imageDimensions: data.image ? `${data.image.width}x${data.image.height}` : 'unknown'
          });
          setImages(prev => [...prev, data.image]);
        } else if (data.type === 'image_update' && participant.identity !== participantId) {
          // Update image position/size from other participant
          console.log('Updating image from:', participant.identity);
          setImages(prev => 
            prev.map(img => img.id === data.image.id ? data.image : img)
          );
        } else if (data.type === 'image_remove' && participant.identity !== participantId) {
          // Remove image from other participant
          console.log('Removing image from:', participant.identity);
          setImages(prev => prev.filter(img => img.id !== data.imageId));
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
        to: 'all participants',
        dataSize: JSON.stringify(data).length
      });
      
      const encodedData = new TextEncoder().encode(JSON.stringify(data));
      
      // Check if data is too large (LiveKit has limits)
      if (encodedData.length > 16384) { // 16KB limit
        console.error('Data too large for LiveKit data channel:', encodedData.length, 'bytes');
        alert(`Image is too large to share (${Math.round(encodedData.length/1024)}KB). Please try a smaller image or use a different format.`);
        return;
      }
      
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

  // Redraw canvas with all strokes (images are handled as overlays)
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
    if (!isOpen || currentMode !== 'draw') return;
    
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
  }, [isOpen, currentMode, getMousePos, currentColor, currentWidth, currentTool, redrawCanvas]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStroke || !isOpen || currentMode !== 'draw') return;
    
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
    if (!currentStroke || !isOpen || currentMode !== 'draw') return;
    
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
    setImages([]);
    setLocalImages([]);
    
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

  // Image handling functions
  const handleImageUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const maxWidth = canvas.width * 0.8;
        const maxHeight = canvas.height * 0.8;
        
        let { width, height } = img;
        
        // Scale image to fit within canvas bounds
        if (width > maxWidth || height > maxHeight) {
          const scale = Math.min(maxWidth / width, maxHeight / height);
          width *= scale;
          height *= scale;
        }
        
        // Create a compressed version for sharing
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;
        
        tempCanvas.width = width;
        tempCanvas.height = height;
        tempCtx.drawImage(img, 0, 0, width, height);
        
        // Try multiple compression levels to get under size limit
        let compressedSrc = '';
        let quality = 0.8;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (attempts < maxAttempts) {
          compressedSrc = tempCanvas.toDataURL('image/jpeg', quality);
          
          // Check if compressed size is acceptable
          if (compressedSrc.length < 12000) { // Leave some buffer under 16KB limit
            break;
          }
          
          // Reduce quality and try again
          quality -= 0.15;
          attempts++;
        }
        
        // If still too large, reduce dimensions
        if (compressedSrc.length >= 12000) {
          const scaleFactor = 0.8;
          const newWidth = Math.floor(width * scaleFactor);
          const newHeight = Math.floor(height * scaleFactor);
          
          tempCanvas.width = newWidth;
          tempCanvas.height = newHeight;
          tempCtx.drawImage(img, 0, 0, newWidth, newHeight);
          
          compressedSrc = tempCanvas.toDataURL('image/jpeg', 0.6);
          
          // Update dimensions
          width = newWidth;
          height = newHeight;
        }
        
        // Final fallback: create a very small thumbnail
        if (compressedSrc.length >= 12000) {
          const thumbnailSize = 200; // Max 200px
          const aspectRatio = img.width / img.height;
          let thumbWidth, thumbHeight;
          
          if (aspectRatio > 1) {
            thumbWidth = thumbnailSize;
            thumbHeight = Math.floor(thumbnailSize / aspectRatio);
          } else {
            thumbHeight = thumbnailSize;
            thumbWidth = Math.floor(thumbnailSize * aspectRatio);
          }
          
          tempCanvas.width = thumbWidth;
          tempCanvas.height = thumbHeight;
          tempCtx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
          
          compressedSrc = tempCanvas.toDataURL('image/jpeg', 0.5);
          
          // Update dimensions
          width = thumbWidth;
          height = thumbHeight;
        }
        
        const newImage: WhiteboardImage = {
          id: `img-${Date.now()}-${Math.random()}`,
          src: compressedSrc,
          x: (canvas.width - width) / 2,
          y: (canvas.height - height) / 2,
          width,
          height,
          originalWidth: img.width,
          originalHeight: img.height
        };
        
        setLocalImages(prev => [...prev, newImage]);
        
        // Send image to other participants
        const message = {
          type: 'image_add',
          image: newImage
        };
        
        console.log('Sending image to participants:', {
          imageId: newImage.id,
          imageSize: newImage.src.length,
          imageDimensions: `${newImage.width}x${newImage.height}`
        });
        
        sendDataToParticipants(message);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
    setShowImageUpload(false);
  }, [sendDataToParticipants]);

  const updateImagePosition = useCallback((imageId: string, x: number, y: number) => {
    setLocalImages(prev => 
      prev.map(img => 
        img.id === imageId ? { ...img, x, y } : img
      )
    );
    
    // Send update to other participants
    const updatedImage = [...images, ...localImages].find(img => img.id === imageId);
    if (updatedImage) {
      const message = {
        type: 'image_update',
        image: { ...updatedImage, x, y }
      };
      sendDataToParticipants(message);
    }
  }, [images, localImages, sendDataToParticipants]);

  const removeImage = useCallback((imageId: string) => {
    setLocalImages(prev => prev.filter(img => img.id !== imageId));
    
    // Send removal to other participants
    const message = {
      type: 'image_remove',
      imageId
    };
    sendDataToParticipants(message);
  }, [sendDataToParticipants]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleImageUpload(imageFile);
    } else {
      alert('Please drop an image file');
    }
  }, [handleImageUpload]);

  if (!isOpen) return null;

  return (
    <div className={styles.whiteboardOverlay}>
      <div className={styles.whiteboardContainer}>

        {/* Compact Top Toolbar - All Controls */}
        <div className={styles.compactToolbar}>
          {/* Action Buttons */}
          <div className={styles.toolGroup}>
            <button
              onClick={downloadWhiteboard}
              className={`${styles.compactButton} ${styles.downloadButton}`}
              title="Download"
            >
              💾
            </button>
            <button
              onClick={clearWhiteboard}
              className={`${styles.compactButton} ${styles.clearButton}`}
              title="Clear"
            >
              🗑️
            </button>
            <button
              onClick={onClose}
              className={`${styles.compactButton} ${styles.closeButton}`}
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Drawing Tools */}
          <div className={styles.toolGroup}>
            <button
              onClick={() => setCurrentTool('pen')}
              className={`${styles.compactButton} ${
                currentTool === 'pen' ? styles.active : ''
              }`}
              title="Pen"
            >
              ✏️
            </button>
            <button
              onClick={() => setCurrentTool('eraser')}
              className={`${styles.compactButton} ${
                currentTool === 'eraser' ? styles.active : ''
              }`}
              title="Eraser"
            >
              🧽
            </button>
          </div>

          {/* Colors */}
          <div className={styles.toolGroup}>
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setCurrentColor(color)}
                className={`${styles.compactColorButton} ${
                  currentColor === color ? styles.active : ''
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>

          {/* Brush Sizes */}
          <div className={styles.toolGroup}>
            {BRUSH_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => setCurrentWidth(size)}
                className={`${styles.compactSizeButton} ${
                  currentWidth === size ? styles.active : ''
                }`}
                title={`Size: ${size}px`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* Image Upload */}
          <div className={styles.toolGroup}>
            <button
              onClick={() => setShowImageUpload(true)}
              className={styles.compactButton}
              title="Upload Image"
            >
              🖼️
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className={styles.whiteboardCanvas}>
          {/* White Background */}
          <div className={styles.whiteboardBackground}></div>
          
          {/* Background Images */}
          {[...images, ...localImages].map((imageData) => (
            <img
              key={imageData.id}
              src={imageData.src}
              alt="Whiteboard image"
              className={styles.backgroundImage}
              style={{
                position: 'absolute',
                left: imageData.x,
                top: imageData.y,
                width: imageData.width,
                height: imageData.height,
                zIndex: 1,
                pointerEvents: 'none'
              }}
            />
          ))}
          
          {/* Image Interaction Overlays (only in move mode) */}
          {currentMode === 'move' && [...images, ...localImages].map((imageData) => (
            <div
              key={`overlay-${imageData.id}`}
              className={styles.imageOverlay}
              style={{
                position: 'absolute',
                left: imageData.x,
                top: imageData.y,
                width: imageData.width,
                height: imageData.height,
                cursor: 'move',
                border: '2px dashed transparent',
                transition: 'border-color 0.2s',
                zIndex: 3
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent';
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingImage(true);
                setDraggedImageId(imageData.id);
                const rect = e.currentTarget.getBoundingClientRect();
                setDragOffset({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top
                });
              }}
              onMouseMove={(e) => {
                if (isDraggingImage && draggedImageId === imageData.id) {
                  e.preventDefault();
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  
                  const canvasRect = canvas.getBoundingClientRect();
                  const newX = e.clientX - canvasRect.left - dragOffset.x;
                  const newY = e.clientY - canvasRect.top - dragOffset.y;
                  
                  // Constrain to canvas bounds
                  const constrainedX = Math.max(0, Math.min(newX, canvas.width - imageData.width));
                  const constrainedY = Math.max(0, Math.min(newY, canvas.height - imageData.height));
                  
                  updateImagePosition(imageData.id, constrainedX, constrainedY);
                }
              }}
              onMouseUp={() => {
                setIsDraggingImage(false);
                setDraggedImageId(null);
              }}
            >
              <button
                className={styles.removeImageButton}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeImage(imageData.id);
                }}
                title="Remove image"
              >
                ✕
              </button>
            </div>
          ))}
          
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

      </div>

      {/* Image Upload Modal */}
      {showImageUpload && (
        <div className={styles.imageUploadModal}>
          <div className={styles.imageUploadContent}>
            <div className={styles.imageUploadHeader}>
              <h3>Upload Image</h3>
              <button
                onClick={() => setShowImageUpload(false)}
                className={styles.closeButton}
              >
                ✕
              </button>
            </div>
            <div className={styles.imageUploadBody}>
              <div 
                className={`${styles.uploadArea} ${isDragOver ? styles.uploadAreaDragOver : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageUpload(file);
                    }
                  }}
                  className={styles.fileInput}
                  id="image-upload"
                />
                <label htmlFor="image-upload" className={styles.uploadLabel}>
                  <div className={styles.uploadIcon}>
                    {isDragOver ? '📤' : '📁'}
                  </div>
                  <div className={styles.uploadText}>
                    <strong>
                      {isDragOver ? 'Drop image here' : 'Click to select image'}
                    </strong>
                    <span>or drag and drop</span>
                  </div>
                  <div className={styles.uploadFormats}>
                    Supports: JPG, PNG, GIF, WebP
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import styles from '../styles/NormalWhiteboard.module.css';
import { NormalWhiteboardToolbar } from './NormalWhiteboardToolbar';
import { NormalWhiteboardLayers } from './NormalWhiteboardLayers';
import {
  DrawAction,
  Layer,
  ToolType,
  Point,
  generateId,
  clearCanvas,
  fillCanvas,
  drawGrid,
  downloadCanvas,
  drawStroke,
  drawRectangle,
  drawCircle,
  drawEllipse,
  drawLine,
  drawArrow,
  drawTriangle,
  drawStar,
  drawText,
  drawImage,
} from './utils/whiteboardUtils';

interface WhiteboardProps {
  isOpen: boolean;
  onClose: () => void;
  isHost: boolean;
  onHostToggle?: (isOpen: boolean) => void;
}

// Fixed virtual canvas dimensions - all devices use the same coordinate space
const VIRTUAL_CANVAS_WIDTH = 1920;
const VIRTUAL_CANVAS_HEIGHT = 1080;

export function Whiteboard({ isOpen, onClose, isHost, onHostToggle }: WhiteboardProps) {
  const room = useRoomContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Participant state
  const [participantId, setParticipantId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);

  // Tool state
  const [currentTool, setCurrentTool] = useState<ToolType>('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentWidth, setCurrentWidth] = useState(3);
  const [currentOpacity, setCurrentOpacity] = useState(1);
  const [fillShapes, setFillShapes] = useState(false);

  // Text tool state
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [isTextInputActive, setIsTextInputActive] = useState(false);
  const [textInputPosition, setTextInputPosition] = useState<Point>({ x: 0, y: 0 });
  const [textInputValue, setTextInputValue] = useState('');

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAction, setCurrentAction] = useState<DrawAction | null>(null);
  const [actions, setActions] = useState<DrawAction[]>([]);
  
  // History state (undo/redo) - synchronized across all participants
  const [history, setHistory] = useState<DrawAction[][]>([[]]);
  const [historyStep, setHistoryStep] = useState(0);

  // Layer state - synchronized across all participants
  const [layers, setLayers] = useState<Layer[]>([
    { id: 'layer-1', name: 'Layer 1', visible: true, locked: false, opacity: 1, zIndex: 0 },
  ]);
  const [activeLayerId, setActiveLayerId] = useState('layer-1');

  // Canvas state
  // Virtual canvas size - fixed for all devices to ensure coordinate space consistency
  const [canvasSize] = useState({ width: VIRTUAL_CANVAS_WIDTH, height: VIRTUAL_CANVAS_HEIGHT });
  // Viewport size - actual display size of the canvas element
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  
  // Pinch-to-zoom state
  const [isPinching, setIsPinching] = useState(false);
  const [pinchStartDistance, setPinchStartDistance] = useState(0);
  const [pinchStartZoom, setPinchStartZoom] = useState(1);
  const [pinchCenter, setPinchCenter] = useState<Point>({ x: 0, y: 0 });

  // Background state
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(20);

  // UI state
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Throttle/debounce refs
  const lastUpdateTime = useRef<number>(0);
  // Detect if device is mobile for more aggressive throttling
  const isMobile = typeof window !== 'undefined' && 
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const UPDATE_THROTTLE_MS = isMobile ? 120 : 80; // More throttling to reduce data size
  const debouncedUpdate = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Set participant ID
  useEffect(() => {
    if (room?.localParticipant) {
      setParticipantId(room.localParticipant.identity);
      setIsConnected(true);
    }
  }, [room]);

  // Safety check: ensure active layer exists
  useEffect(() => {
    if (layers.length > 0 && !layers.find(l => l.id === activeLayerId)) {
      // Active layer was deleted, switch to first available layer
      setActiveLayerId(layers[0].id);
    }
  }, [layers, activeLayerId]);

  // Send data to other participants
  const sendDataToParticipants = useCallback((data: any, skipIfTooLarge: boolean = false) => {
    if (!room) return false;
    
    try {
      const encodedData = new TextEncoder().encode(JSON.stringify(data));
      
      // Check data size limit (16KB)
      if (encodedData.length > 16384) {
        if (skipIfTooLarge) {
          // Silently skip for real-time updates that are too large
          return false;
        }
        console.error('Data too large for LiveKit data channel:', encodedData.length, 'bytes');
        return false;
      }
      
      room.localParticipant.publishData(encodedData, { topic: 'whiteboard' });
      return true;
    } catch (error) {
      console.error('Error sending whiteboard data:', error);
      return false;
    }
  }, [room]);

  // Handle incoming whiteboard data from other participants
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        
        if (participant.identity === participantId) return; // Ignore own messages
        
        // Handle whiteboard_toggle even when whiteboard is closed
        if (data.type === 'whiteboard_toggle') {
          if (data.isHost && onHostToggle) {
            onHostToggle(data.action === 'open');
          }
          return;
        }
        
        // Only process other whiteboard data when whiteboard is open
        if (!isOpen) return;
        
        // Only process whiteboard-related message types
        const whiteboardTypes = [
          'action_complete',
          'action_update',
          'clear',
          'undo',
          'redo',
          'layer_add',
          'layer_delete',
          'layer_update',
          'layer_reorder',
          'background_update',
          'history_sync',
        ];
        
        if (!whiteboardTypes.includes(data.type)) {
          return; // Ignore non-whiteboard data
        }

        switch (data.type) {
          case 'action_complete':
            // Add completed action from another participant
            if (data.action) {
              setActions(prev => [...prev, data.action]);
            }
            break;

          case 'action_update':
            // Real-time action update (shapes, strokes being drawn)
            if (data.action) {
              setCurrentAction(data.action);
            }
            break;

          case 'clear':
            // Clear whiteboard
            setActions([]);
            setHistory([[]]);
            setHistoryStep(0);
            setCurrentAction(null);
            break;

          case 'undo':
            // Synchronized undo
            if (data.historyStep !== undefined && data.actions) {
              setHistoryStep(data.historyStep);
              setActions(data.actions);
              setCurrentAction(null);
            }
            break;

          case 'redo':
            // Synchronized redo
            if (data.historyStep !== undefined && data.actions) {
              setHistoryStep(data.historyStep);
              setActions(data.actions);
              setCurrentAction(null);
            }
            break;

          case 'layer_add':
            // Add layer
            if (data.layer) {
              setLayers(prev => [...prev, data.layer]);
            }
            break;

          case 'layer_delete':
            // Delete layer
            if (data.layerId) {
              setLayers(prev => prev.filter(l => l.id !== data.layerId));
              if (data.layerId === activeLayerId && data.newActiveLayerId) {
                setActiveLayerId(data.newActiveLayerId);
              }
            }
            break;

          case 'layer_update':
            // Update layer properties
            if (data.layer) {
              setLayers(prev => prev.map(l => l.id === data.layer.id ? data.layer : l));
            }
            break;

          case 'layer_reorder':
            // Reorder layers
            if (data.layers && Array.isArray(data.layers)) {
              setLayers(data.layers);
            }
            break;

          case 'active_layer_change':
            // Active layer changed (optional - usually local only)
            // setActiveLayerId(data.layerId);
            break;

          case 'background_update':
            // Background settings update
            if (data.backgroundColor) setBackgroundColor(data.backgroundColor);
            if (data.showGrid !== undefined) setShowGrid(data.showGrid);
            if (data.gridSize !== undefined) setGridSize(data.gridSize);
            break;

          case 'history_sync':
            // Full history synchronization
            if (data.history && data.historyStep !== undefined && data.actions) {
              setHistory(data.history);
              setHistoryStep(data.historyStep);
              setActions(data.actions);
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing whiteboard data:', error);
        // Don't crash - just log the error
      }
    };

    room.on('dataReceived', handleDataReceived);
    
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, participantId, activeLayerId, onHostToggle, isOpen]);

  // Initialize canvas
  useEffect(() => {
    setMounted(true);
    if (!canvasRef.current || !canvasContainerRef.current || !isOpen) return;

    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      // Set display canvas size to viewport (for rendering)
      canvas.width = Math.floor(rect.width);
      canvas.height = Math.floor(rect.height);
      // Store viewport size separately (virtual canvas size is fixed)
      setViewportSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
    };
  }, [isOpen]);

  // Auto-fit function - reusable for initial load and orientation changes
  const autoFitCanvas = useCallback(() => {
    if (!canvasContainerRef.current) return;
    
    const isMobileDevice = typeof window !== 'undefined' && 
      (window.innerWidth <= 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0);
    
    if (isMobileDevice) {
      // Use canvas container (not the main container which includes toolbar)
      const canvasContainer = canvasContainerRef.current;
      const rect = canvasContainer.getBoundingClientRect();
      const containerWidth = rect.width;
      const containerHeight = rect.height;
      
      // Only proceed if we have valid dimensions
      if (containerWidth > 0 && containerHeight > 0) {
        // Calculate zoom to fit entire virtual canvas
        const zoomX = containerWidth / canvasSize.width;
        const zoomY = containerHeight / canvasSize.height;
        const fitZoom = Math.min(zoomX, zoomY) * 0.95; // 95% to add some padding
        
        // Center the canvas
        const centerX = (containerWidth - canvasSize.width * fitZoom) / 2;
        const centerY = (containerHeight - canvasSize.height * fitZoom) / 2;
        
        setZoom(fitZoom);
        setPan({ x: centerX, y: centerY });
      }
    }
  }, [canvasSize]);

  // Auto-fit virtual canvas on mobile when whiteboard opens or orientation changes
  useEffect(() => {
    if (!isOpen) return;
    
    const isMobileDevice = typeof window !== 'undefined' && 
      (window.innerWidth <= 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0);
    
    if (isMobileDevice) {
      // Initial fit with delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        autoFitCanvas();
      }, 100);
      
      // Handle orientation changes and window resize
      const handleResize = () => {
        // Small delay to let browser finish resizing
        setTimeout(() => {
          autoFitCanvas();
        }, 150);
      };
      
      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleResize);
      
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
      };
    }
  }, [isOpen, autoFitCanvas]);

  // Redraw canvas - renders virtual canvas content with zoom/pan
  const redrawCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Clear display canvas (viewport size)
    clearCanvas(ctx, viewportSize.width, viewportSize.height);

    // Apply zoom and pan transformations
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Fill background of virtual canvas
    fillCanvas(ctx, canvasSize.width, canvasSize.height, backgroundColor);

    // Draw grid if enabled (on virtual canvas)
    if (showGrid) {
      drawGrid(ctx, canvasSize.width, canvasSize.height, gridSize, '#cccccc');
    }

    // Sort actions by layer z-index
    const sortedActions = [...actions].sort((a, b) => {
      const layerA = layers.find(l => l.id === a.layerId);
      const layerB = layers.find(l => l.id === b.layerId);
      return (layerA?.zIndex || 0) - (layerB?.zIndex || 0);
    });

    // Draw all actions
    sortedActions.forEach(action => {
      const layer = layers.find(l => l.id === action.layerId);
      if (!layer || !layer.visible) return;

      ctx.globalAlpha = action.opacity * layer.opacity;

      switch (action.type) {
        case 'stroke':
          if (action.points && action.points.length > 0) {
            drawStroke(ctx, action.points, action.color, action.width, action.opacity, action.tool);
          }
          break;
        case 'shape':
          if (action.startPoint && action.endPoint) {
            switch (action.shapeType) {
              case 'rectangle':
                drawRectangle(ctx, action.startPoint, action.endPoint, action.color, action.width, action.opacity, action.fill || false);
                break;
              case 'circle':
                drawCircle(ctx, action.startPoint, action.endPoint, action.color, action.width, action.opacity, action.fill || false);
                break;
              case 'ellipse':
                drawEllipse(ctx, action.startPoint, action.endPoint, action.color, action.width, action.opacity, action.fill || false);
                break;
              case 'line':
                drawLine(ctx, action.startPoint, action.endPoint, action.color, action.width, action.opacity);
                break;
              case 'arrow':
                drawArrow(ctx, action.startPoint, action.endPoint, action.color, action.width, action.opacity);
                break;
              case 'triangle':
                drawTriangle(ctx, action.startPoint, action.endPoint, action.color, action.width, action.opacity, action.fill || false);
                break;
              case 'star':
                drawStar(ctx, action.startPoint, action.endPoint, action.color, action.width, action.opacity, action.fill || false);
                break;
            }
          }
          break;
        case 'text':
          if (action.text && action.startPoint) {
            drawText(ctx, action.text, action.startPoint, action.color, action.fontSize || 16, action.fontFamily || 'Arial', action.opacity);
          }
          break;
        case 'image':
          if (action.imageData && action.imagePosition && action.imageSize) {
            const img = new Image();
            img.src = action.imageData;
            if (img.complete) {
              drawImage(ctx, img, action.imagePosition, action.imageSize, action.opacity);
            }
          }
          break;
      }
    });

    // Draw current action if drawing
    if (currentAction) {
      const layer = layers.find(l => l.id === currentAction.layerId);
      if (layer && layer.visible) {
        ctx.globalAlpha = currentAction.opacity * layer.opacity;
        
        switch (currentAction.type) {
          case 'stroke':
            if (currentAction.points && currentAction.points.length > 0) {
              drawStroke(ctx, currentAction.points, currentAction.color, currentAction.width, currentAction.opacity, currentAction.tool);
            }
            break;
          case 'shape':
            if (currentAction.startPoint && currentAction.endPoint) {
              switch (currentAction.shapeType) {
                case 'rectangle':
                  drawRectangle(ctx, currentAction.startPoint, currentAction.endPoint, currentAction.color, currentAction.width, currentAction.opacity, currentAction.fill || false);
                  break;
                case 'circle':
                  drawCircle(ctx, currentAction.startPoint, currentAction.endPoint, currentAction.color, currentAction.width, currentAction.opacity, currentAction.fill || false);
                  break;
                case 'ellipse':
                  drawEllipse(ctx, currentAction.startPoint, currentAction.endPoint, currentAction.color, currentAction.width, currentAction.opacity, currentAction.fill || false);
                  break;
                case 'line':
                  drawLine(ctx, currentAction.startPoint, currentAction.endPoint, currentAction.color, currentAction.width, currentAction.opacity);
                  break;
                case 'arrow':
                  drawArrow(ctx, currentAction.startPoint, currentAction.endPoint, currentAction.color, currentAction.width, currentAction.opacity);
                  break;
                case 'triangle':
                  drawTriangle(ctx, currentAction.startPoint, currentAction.endPoint, currentAction.color, currentAction.width, currentAction.opacity, currentAction.fill || false);
                  break;
                case 'star':
                  drawStar(ctx, currentAction.startPoint, currentAction.endPoint, currentAction.color, currentAction.width, currentAction.opacity, currentAction.fill || false);
                  break;
              }
            }
            break;
        }
      }
    }

    ctx.restore();
  }, [actions, currentAction, layers, backgroundColor, showGrid, gridSize, zoom, pan, canvasSize, viewportSize]);

  // Redraw when dependencies change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Smooth real-time drawing with requestAnimationFrame
  useEffect(() => {
    if (isDrawing && currentAction) {
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
  }, [isDrawing, currentAction, redrawCanvas]);

  // Get mouse/touch position - converts viewport coordinates to virtual canvas coordinates
  const getCanvasPoint = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX: number, clientY: number;
    if ('touches' in e) {
      // Use the first touch point for drawing
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        return { x: 0, y: 0 };
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Get position relative to canvas viewport
    const viewportX = clientX - rect.left;
    const viewportY = clientY - rect.top;

    // Account for device pixel ratio if canvas is scaled
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Transform viewport coordinates to virtual canvas coordinates
    // Formula: virtualX = (viewportX - pan.x) / zoom
    const x = (viewportX * scaleX - pan.x) / zoom;
    const y = (viewportY * scaleY - pan.y) / zoom;

    return { x, y };
  }, [zoom, pan]);

  // Calculate distance between two touch points
  const getTouchDistance = useCallback((touches: TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Get center point between two touches
  const getTouchCenter = useCallback((touches: TouchList, rect: DOMRect): Point => {
    if (touches.length < 2) return { x: 0, y: 0 };
    const x = (touches[0].clientX + touches[1].clientX) / 2 - rect.left;
    const y = (touches[0].clientY + touches[1].clientY) / 2 - rect.top;
    return { x, y };
  }, []);

  // Mouse/touch handlers
  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default touch behaviors
    if ('touches' in e) {
      e.preventDefault();
      
      // Handle pinch-to-zoom (two fingers)
      if (e.touches.length === 2) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const distance = getTouchDistance(e.touches);
        const center = getTouchCenter(e.touches, rect);
        
        setIsPinching(true);
        setPinchStartDistance(distance);
        setPinchStartZoom(zoom);
        setPinchCenter(center);
        setIsPanning(false);
        setIsDrawing(false);
        return;
      }
      
      // Two-finger pan (when not pinching) - enable pan mode
      if (e.touches.length === 2 && !isPinching) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        // Use center point of two touches for panning
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        
        setIsPanning(true);
        setPanStart({ x: (centerX - pan.x) / zoom, y: (centerY - pan.y) / zoom });
        return;
      }
      
      // Single touch - proceed with normal drawing/panning
      if (e.touches.length > 1) return;
    } else {
      e.preventDefault();
    }
    
    const point = getCanvasPoint(e);

    // Check if we're in pan mode
    const isPanMode = currentTool === 'pointer' || ('button' in e && e.button === 1);
    if (isPanMode) {
      setIsPanning(true);
      setPanStart(point);
      return;
    }

    // Text tool - show input
    if (currentTool === 'text') {
      setIsTextInputActive(true);
      setTextInputPosition(point);
      setTextInputValue('');
      return;
    }

    // Check if layer is locked
    const activeLayer = layers.find(l => l.id === activeLayerId);
    if (activeLayer?.locked) return;
    
    setIsDrawing(true);

    // Create new action based on tool
    const isShape = ['rectangle', 'circle', 'ellipse', 'line', 'arrow', 'triangle', 'star'].includes(currentTool);

    const newAction: DrawAction = {
      id: generateId(),
      type: isShape ? 'shape' : 'stroke',
      tool: currentTool,
      color: currentColor,
      width: currentWidth,
      opacity: currentOpacity,
      layerId: activeLayerId,
      fill: fillShapes,
      ...(isShape ? {
        shapeType: currentTool as any,
        startPoint: point,
        endPoint: point,
      } : {
        points: [point],
      }),
    };

    setCurrentAction(newAction);
  }, [currentTool, currentColor, currentWidth, currentOpacity, fillShapes, activeLayerId, layers, getCanvasPoint]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default behaviors
    if ('touches' in e) {
      e.preventDefault();
      
      // Handle two-finger pan (when not pinching)
      if (e.touches.length === 2 && !isPinching && isPanning) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const startScreenX = panStart.x * zoom + pan.x;
        const startScreenY = panStart.y * zoom + pan.y;
        
        let newPanX = pan.x + (centerX - startScreenX);
        let newPanY = pan.y + (centerY - startScreenY);
        
        // Apply boundary constraints
        const maxPanX = 0;
        const minPanX = rect.width - canvasSize.width * zoom;
        const maxPanY = 0;
        const minPanY = rect.height - canvasSize.height * zoom;
        
        newPanX = Math.max(minPanX, Math.min(maxPanX, newPanX));
        newPanY = Math.max(minPanY, Math.min(maxPanY, newPanY));
        
        setPan({ x: newPanX, y: newPanY });
        setPanStart({ x: (centerX - pan.x) / zoom, y: (centerY - pan.y) / zoom });
        return;
      }
      
      // Handle pinch-to-zoom
      if (e.touches.length === 2 && isPinching) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const distance = getTouchDistance(e.touches);
        const center = getTouchCenter(e.touches, rect);
        
        if (pinchStartDistance > 0) {
          // Calculate zoom based on distance change
          const scale = distance / pinchStartDistance;
          const newZoom = Math.max(0.1, Math.min(3, pinchStartZoom * scale));
          
          // Adjust pan to zoom around the pinch center
          const zoomChange = newZoom / zoom;
          const newPanX = center.x - (center.x - pan.x) * zoomChange;
          const newPanY = center.y - (center.y - pan.y) * zoomChange;
          
          setZoom(newZoom);
          setPan({ x: newPanX, y: newPanY });
        }
        return;
      }
      
      // Ignore multi-touch during drawing
      if (e.touches.length > 1 && !isPinching) return;
    } else {
      e.preventDefault();
    }
    
    const point = getCanvasPoint(e);

    if (isPanning && panStart) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      let clientX: number, clientY: number;
      if ('touches' in e) {
        if (e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else {
          return;
        }
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      
      const currentScreenX = clientX - rect.left;
      const currentScreenY = clientY - rect.top;
      const startScreenX = panStart.x * zoom + pan.x;
      const startScreenY = panStart.y * zoom + pan.y;
      
      // Calculate new pan position
      let newPanX = pan.x + (currentScreenX - startScreenX);
      let newPanY = pan.y + (currentScreenY - startScreenY);
      
      // Apply boundary constraints to keep virtual canvas visible
      const maxPanX = 0;
      const minPanX = rect.width - canvasSize.width * zoom;
      const maxPanY = 0;
      const minPanY = rect.height - canvasSize.height * zoom;
      
      newPanX = Math.max(minPanX, Math.min(maxPanX, newPanX));
      newPanY = Math.max(minPanY, Math.min(maxPanY, newPanY));
      
      setPan({ x: newPanX, y: newPanY });
      
      setPanStart({
        x: (currentScreenX - pan.x) / zoom,
        y: (currentScreenY - pan.y) / zoom
      });
      return;
    }

    if (!isDrawing || !currentAction) return;

    // Update current action
    const updatedAction = currentAction.type === 'stroke'
      ? { ...currentAction, points: [...(currentAction.points || []), point] }
      : { ...currentAction, endPoint: point };

    setCurrentAction(updatedAction);

    // Send real-time update (throttled)
    // For strokes, only send simplified updates to avoid exceeding data limit
    const now = Date.now();
    if (now - lastUpdateTime.current >= UPDATE_THROTTLE_MS) {
      if (updatedAction.type === 'stroke' && updatedAction.points && updatedAction.points.length > 50) {
        // For long strokes, only send the last 20 points and the total count for smooth rendering
        const simplifiedAction = {
          ...updatedAction,
          points: updatedAction.points.slice(-20), // Last 20 points
          totalPoints: updatedAction.points.length, // Total count for reference
        };
        // Skip silently if still too large
        sendDataToParticipants({
          type: 'action_update',
          action: simplifiedAction
        }, true);
      } else {
        // For shapes or short strokes, send full update
        sendDataToParticipants({
          type: 'action_update',
          action: updatedAction
        }, true);
      }
      lastUpdateTime.current = now;
    }
  }, [isDrawing, isPanning, isPinching, currentAction, getCanvasPoint, panStart, zoom, pan, canvasSize, sendDataToParticipants, getTouchDistance, getTouchCenter, pinchStartDistance, pinchStartZoom]);

  const handlePointerUp = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    // Handle pinch end
    if (isPinching) {
      setIsPinching(false);
      setPinchStartDistance(0);
      return;
    }
    
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isDrawing || !currentAction) return;
    
    setIsDrawing(false);
    
    // Add action to history
    const newActions = [...actions, currentAction];
    setActions(newActions);

    // Update history for undo/redo
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(newActions);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);

    // Send completed action to other participants
    // If the action is too large, try to simplify it
    let actionToSend = currentAction;
    if (currentAction.type === 'stroke' && currentAction.points && currentAction.points.length > 100) {
      // For very long strokes, we might need to simplify points
      // But for now, try sending as-is - if it fails, we'll handle it
      const testSize = new TextEncoder().encode(JSON.stringify({
        type: 'action_complete',
        action: currentAction
      })).length;
      
      if (testSize > 16384) {
        // If still too large, sample points (keep every Nth point)
        const points = currentAction.points;
        const sampleRate = Math.ceil(points.length / 500); // Target ~500 points max
        const sampledPoints = points.filter((_, index) => index % sampleRate === 0 || index === points.length - 1);
        actionToSend = {
          ...currentAction,
          points: sampledPoints
        };
      }
    }
    
    // Send the action (will fail silently if still too large, but that's rare for completed actions)
    const sent = sendDataToParticipants({
      type: 'action_complete',
      action: actionToSend
    }, false);
    
    if (!sent && currentAction.type === 'stroke' && currentAction.points && currentAction.points.length > 100) {
      console.warn('Completed stroke too large to send, simplified version sent');
    }

    setCurrentAction(null);
  }, [isDrawing, isPanning, currentAction, actions, history, historyStep, sendDataToParticipants]);

  // Text input handlers
  const handleTextSubmit = useCallback(() => {
    if (!textInputValue.trim()) {
      setIsTextInputActive(false);
      return;
    }

    const newAction: DrawAction = {
      id: generateId(),
      type: 'text',
      tool: 'text',
      color: currentColor,
      width: currentWidth,
      opacity: currentOpacity,
      layerId: activeLayerId,
      text: textInputValue,
      fontSize,
      fontFamily,
      startPoint: textInputPosition,
    };

    const newActions = [...actions, newAction];
    setActions(newActions);

    // Update history
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(newActions);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);

    // Send to other participants
    sendDataToParticipants({
      type: 'action_complete',
      action: newAction
    });

    setIsTextInputActive(false);
    setTextInputValue('');
  }, [textInputValue, currentColor, currentWidth, currentOpacity, activeLayerId, fontSize, fontFamily, textInputPosition, actions, history, historyStep, sendDataToParticipants]);

  // Undo/Redo - Synchronized
  const undo = useCallback(() => {
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      const newActions = history[newStep];
      
      setHistoryStep(newStep);
      setActions(newActions);

      // Broadcast undo to all participants
      sendDataToParticipants({
        type: 'undo',
        historyStep: newStep,
        actions: newActions
      });
    }
  }, [historyStep, history, sendDataToParticipants]);

  const redo = useCallback(() => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1;
      const newActions = history[newStep];
      
      setHistoryStep(newStep);
      setActions(newActions);

      // Broadcast redo to all participants
      sendDataToParticipants({
        type: 'redo',
        historyStep: newStep,
        actions: newActions
      });
    }
  }, [historyStep, history, sendDataToParticipants]);

  // Layer management - Synchronized
  const handleLayersChange = useCallback((newLayers: Layer[]) => {
    setLayers(newLayers);
    
    // Broadcast layer reorder
    sendDataToParticipants({
      type: 'layer_reorder',
      layers: newLayers
    });
  }, [sendDataToParticipants]);

  const handleActiveLayerChange = useCallback((layerId: string) => {
    setActiveLayerId(layerId);
    
    // Optional: broadcast active layer change
    // sendDataToParticipants({
    //   type: 'active_layer_change',
    //   layerId
    // });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Redo: Ctrl+Y or Cmd+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }

      // Escape: Cancel current action
      if (e.key === 'Escape') {
        setIsDrawing(false);
        setCurrentAction(null);
        setIsTextInputActive(false);
      }

      // Enter: Submit text
      if (e.key === 'Enter' && isTextInputActive && !e.shiftKey) {
        e.preventDefault();
        handleTextSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, undo, redo, isTextInputActive, handleTextSubmit]);

  // Clear canvas
  const handleClear = useCallback(() => {
    const newActions: DrawAction[] = [];
    setActions(newActions);
    
    const newHistory = [[]];
    setHistory(newHistory);
    setHistoryStep(0);

    // Broadcast clear to all participants
    sendDataToParticipants({
      type: 'clear'
    });
  }, [sendDataToParticipants]);

  // Fit to screen handler
  const handleFitToScreen = useCallback(() => {
    if (!canvasContainerRef.current) return;
    const container = canvasContainerRef.current;
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    
    // Calculate zoom to fit entire virtual canvas
    const zoomX = containerWidth / canvasSize.width;
    const zoomY = containerHeight / canvasSize.height;
    const fitZoom = Math.min(zoomX, zoomY) * 0.95; // 95% to add some padding
    
    // Center the canvas
    const centerX = (containerWidth - canvasSize.width * fitZoom) / 2;
    const centerY = (containerHeight - canvasSize.height * fitZoom) / 2;
    
    setZoom(fitZoom);
    setPan({ x: centerX, y: centerY });
  }, [canvasSize]);

  // Export canvas
  const handleExport = useCallback((format: 'png' | 'jpg' = 'png') => {
    if (!canvasRef.current) return;
    const filename = `whiteboard-${new Date().toISOString().slice(0, 10)}`;
    downloadCanvas(canvasRef.current, filename, format);
  }, []);

  // Import image
  const handleImportImage = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setIsUploadingImage(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) {
          setIsUploadingImage(false);
          return;
        }

        const canvas = canvasRef.current;
        const maxWidth = canvas.width * 0.5;
        const maxHeight = canvas.height * 0.5;

        let { width, height } = img;

        // Scale image to fit (start smaller)
        if (width > maxWidth || height > maxHeight) {
          const scale = Math.min(maxWidth / width, maxHeight / height);
          width *= scale;
          height *= scale;
        }

        // Compress image for sharing with multiple attempts
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
          setIsUploadingImage(false);
          return;
        }

        tempCanvas.width = width;
        tempCanvas.height = height;
        tempCtx.drawImage(img, 0, 0, width, height);

        let compressedSrc = '';
        let currentQuality = 0.6;
        let currentWidth = width;
        let currentHeight = height;
        const MAX_SIZE = 15000; // Leave buffer under 16KB limit
        let attempts = 0;
        const maxAttempts = 10;

        // Try to compress until we get under the size limit
        while (attempts < maxAttempts) {
          compressedSrc = tempCanvas.toDataURL('image/jpeg', currentQuality);
          
          // Create message to check size
          const testMessage = {
            type: 'action_complete',
            action: {
              id: generateId(),
              type: 'image',
              tool: 'pen',
              color: currentColor,
              width: currentWidth,
              opacity: currentOpacity,
              layerId: activeLayerId,
              imageData: compressedSrc,
              imagePosition: { x: 0, y: 0 },
              imageSize: { width: currentWidth, height: currentHeight },
            }
          };
          
          const testSize = new TextEncoder().encode(JSON.stringify(testMessage)).length;
          
          if (testSize < MAX_SIZE) {
            // Success! Image is small enough
            break;
          }
          
          attempts++;
          
          // Try reducing quality first
          if (currentQuality > 0.2) {
            currentQuality -= 0.1;
          } else {
            // If quality is already low, reduce dimensions
            currentWidth = Math.floor(currentWidth * 0.8);
            currentHeight = Math.floor(currentHeight * 0.8);
            
            if (currentWidth < 50 || currentHeight < 50) {
              // Image is too small, give up
              alert('Image is too large to share. Please try a smaller image.');
              setIsUploadingImage(false);
              return;
            }
            
            tempCanvas.width = currentWidth;
            tempCanvas.height = currentHeight;
            tempCtx.drawImage(img, 0, 0, currentWidth, currentHeight);
            currentQuality = 0.6; // Reset quality for new size
          }
        }

        if (attempts >= maxAttempts) {
          alert('Unable to compress image small enough for sharing. Please try a smaller image.');
          setIsUploadingImage(false);
          return;
        }

        const newAction: DrawAction = {
          id: generateId(),
          type: 'image',
          tool: 'pen',
          color: currentColor,
          width: currentWidth,
          opacity: currentOpacity,
          layerId: activeLayerId,
          imageData: compressedSrc,
          imagePosition: {
            x: (canvas.width - currentWidth) / 2,
            y: (canvas.height - currentHeight) / 2,
          },
          imageSize: { width: currentWidth, height: currentHeight },
        };

        const newActions = [...actions, newAction];
        setActions(newActions);

        // Update history
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(newActions);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);

        // Send to other participants
        sendDataToParticipants({
          type: 'action_complete',
          action: newAction
        });

        setIsUploadingImage(false);
      };
      img.onerror = () => {
        alert('Failed to load image');
        setIsUploadingImage(false);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      alert('Failed to read image file');
      setIsUploadingImage(false);
    };
    reader.readAsDataURL(file);
  }, [currentColor, currentWidth, currentOpacity, activeLayerId, actions, history, historyStep, sendDataToParticipants]);

  // Update background settings
  const handleBackgroundColorChange = useCallback((color: string) => {
    setBackgroundColor(color);
    sendDataToParticipants({
      type: 'background_update',
      backgroundColor: color,
      showGrid,
      gridSize
    });
  }, [showGrid, gridSize, sendDataToParticipants]);

  const handleShowGridChange = useCallback((show: boolean) => {
    setShowGrid(show);
    sendDataToParticipants({
      type: 'background_update',
      backgroundColor,
      showGrid: show,
      gridSize
    });
  }, [backgroundColor, gridSize, sendDataToParticipants]);

  const handleGridSizeChange = useCallback((size: number) => {
    setGridSize(size);
    sendDataToParticipants({
      type: 'background_update',
      backgroundColor,
      showGrid,
      gridSize: size
    });
  }, [backgroundColor, showGrid, sendDataToParticipants]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        {/* Toolbar */}
        <NormalWhiteboardToolbar
          currentTool={currentTool}
          onToolChange={setCurrentTool}
          currentColor={currentColor}
          onColorChange={setCurrentColor}
          currentWidth={currentWidth}
          onWidthChange={setCurrentWidth}
          currentOpacity={currentOpacity}
          onOpacityChange={setCurrentOpacity}
          fillShapes={fillShapes}
          onFillShapesChange={setFillShapes}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
          backgroundColor={backgroundColor}
          onBackgroundColorChange={handleBackgroundColorChange}
          showGrid={showGrid}
          onShowGridChange={handleShowGridChange}
          gridSize={gridSize}
          onGridSizeChange={handleGridSizeChange}
          zoom={zoom}
          onZoomChange={setZoom}
          onFitToScreen={handleFitToScreen}
          canUndo={historyStep > 0}
          canRedo={historyStep < history.length - 1}
          onUndo={undo}
          onRedo={redo}
          onClear={handleClear}
          onExport={handleExport}
          onImportImage={handleImportImage}
          onClose={onClose}
          onToggleLayers={() => setShowLayersPanel(!showLayersPanel)}
          showLayersPanel={showLayersPanel}
        />

        {/* Canvas Container */}
        <div ref={canvasContainerRef} className={styles.canvasContainer}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            onTouchCancel={handlePointerUp}
            onTouchCancel={handlePointerUp}
            style={{
              touchAction: 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
            }}
          />

          {/* Text Input Overlay */}
          {isTextInputActive && (
            <div
              className={styles.textInput}
              style={{
                left: textInputPosition.x * zoom + pan.x,
                top: textInputPosition.y * zoom + pan.y,
              }}
            >
              <textarea
                autoFocus
                value={textInputValue}
                onChange={(e) => setTextInputValue(e.target.value)}
                onBlur={handleTextSubmit}
                style={{
                  fontSize: `${fontSize}px`,
                  fontFamily,
                  color: currentColor,
                }}
                placeholder="Type text..."
              />
            </div>
          )}
        </div>

        {/* Layers Panel */}
        {showLayersPanel && (
          <NormalWhiteboardLayers
            layers={layers}
            activeLayerId={activeLayerId}
            onLayersChange={handleLayersChange}
            onActiveLayerChange={handleActiveLayerChange}
          />
        )}

        {/* Image Upload Loading Spinner */}
        {isUploadingImage && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              padding: isMobile ? '20px 28px' : '24px 32px',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              zIndex: 100,
              backdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              minWidth: isMobile ? '200px' : '240px',
            }}
          >
            <div
              style={{
                width: isMobile ? '40px' : '48px',
                height: isMobile ? '40px' : '48px',
                border: '4px solid rgba(255, 255, 255, 0.2)',
                borderTop: '4px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <div style={{ 
              fontSize: isMobile ? '14px' : '16px', 
              fontWeight: '500',
              textAlign: 'center'
            }}>
              Processing image...
            </div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
}

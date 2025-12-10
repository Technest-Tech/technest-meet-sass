'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
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

interface NormalWhiteboardProps {
  isOpen: boolean;
  onClose: () => void;
}

// Fixed virtual canvas dimensions - all devices use the same coordinate space
const VIRTUAL_CANVAS_WIDTH = 1920;
const VIRTUAL_CANVAS_HEIGHT = 1080;

export function NormalWhiteboard({ isOpen, onClose }: NormalWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

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

  // History state (undo/redo)
  const [history, setHistory] = useState<DrawAction[][]>([[]]);
  const [historyStep, setHistoryStep] = useState(0);

  // Layer state
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
      ctx.globalAlpha = currentAction.opacity;

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

    ctx.restore();
  }, [actions, currentAction, layers, backgroundColor, showGrid, gridSize, zoom, pan, canvasSize, viewportSize]);

  // Redraw when dependencies change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Get mouse/touch position - converts viewport coordinates to virtual canvas coordinates
  const getCanvasPoint = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
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
    e.preventDefault();
    
    // Handle pinch-to-zoom (two fingers)
    if ('touches' in e && e.touches.length === 2) {
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
    
    const point = getCanvasPoint(e);

    // Check if we're in pan mode (space key or pointer tool with middle mouse)
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
  }, [currentTool, currentColor, currentWidth, currentOpacity, fillShapes, activeLayerId, layers, getCanvasPoint, getTouchDistance, getTouchCenter]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    // Handle pinch-to-zoom
    if ('touches' in e && e.touches.length === 2 && isPinching) {
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
    
    const point = getCanvasPoint(e);

    if (isPanning && panStart) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      let clientX: number, clientY: number;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
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

    if (currentAction.type === 'stroke') {
      setCurrentAction(prev => ({
        ...prev!,
        points: [...(prev!.points || []), point],
      }));
    } else if (currentAction.type === 'shape') {
      setCurrentAction(prev => ({
        ...prev!,
        endPoint: point,
      }));
    }
  }, [isDrawing, isPanning, isPinching, currentAction, getCanvasPoint, panStart, zoom, pan, getTouchDistance, getTouchCenter, pinchStartDistance, pinchStartZoom]);

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

    setCurrentAction(null);
  }, [isDrawing, isPanning, currentAction, actions, history, historyStep]);

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

    setIsTextInputActive(false);
    setTextInputValue('');
  }, [textInputValue, currentColor, currentWidth, currentOpacity, activeLayerId, fontSize, fontFamily, textInputPosition, actions, history, historyStep]);

  // Undo/Redo
  const undo = useCallback(() => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      setActions(history[historyStep - 1]);
    }
  }, [historyStep, history]);

  const redo = useCallback(() => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      setActions(history[historyStep + 1]);
    }
  }, [historyStep, history]);

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

    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(newActions);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  }, [history, historyStep]);

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

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) return;

        // Calculate size to fit in canvas
        const canvas = canvasRef.current;
        const maxWidth = canvas.width * 0.8;
        const maxHeight = canvas.height * 0.8;

        let { width, height } = img;

        // Scale image to fit
        if (width > maxWidth || height > maxHeight) {
          const scale = Math.min(maxWidth / width, maxHeight / height);
          width *= scale;
          height *= scale;
        }

        const newAction: DrawAction = {
          id: generateId(),
          type: 'image',
          tool: 'pen',
          color: currentColor,
          width: currentWidth,
          opacity: currentOpacity,
          layerId: activeLayerId,
          imageData: e.target?.result as string,
          imagePosition: {
            x: (canvas.width - width) / 2,
            y: (canvas.height - height) / 2,
          },
          imageSize: { width, height },
        };

        const newActions = [...actions, newAction];
        setActions(newActions);

        // Update history
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(newActions);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [currentColor, currentWidth, currentOpacity, activeLayerId, actions, history, historyStep]);

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
          onBackgroundColorChange={setBackgroundColor}
          showGrid={showGrid}
          onShowGridChange={setShowGrid}
          gridSize={gridSize}
          onGridSizeChange={setGridSize}
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
            onLayersChange={setLayers}
            onActiveLayerChange={setActiveLayerId}
          />
        )}
      </div>
    </div>
  );
}


'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import * as pdfjsLib from 'pdfjs-dist';
import { RoomFile, PdfAnnotationData, DrawingStroke, DrawingPoint } from '@/lib/types';
import toast from 'react-hot-toast';
import styles from '@/styles/PdfViewer.module.css';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface PdfViewerProps {
  isOpen: boolean;
  onClose: () => void;
  file: RoomFile | null;
  roomName: string;
  isHost: boolean;
  onOpenForAll?: (file: RoomFile) => void;
  onCloseForAll?: () => void;
}

const COLORS = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
const BRUSH_SIZES = [2, 4, 8];

export function PdfViewer({ isOpen, onClose, file, roomName, isHost }: PdfViewerProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = useState('#FF0000');
  const [currentWidth, setCurrentWidth] = useState(4);
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);
  
  // Stroke storage per page
  const [strokes, setStrokes] = useState<Map<number, DrawingStroke[]>>(new Map());
  
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Load PDF when file changes
  useEffect(() => {
    if (file && isOpen) {
      loadPdf();
    }
    
    return () => {
      if (pdfDocument) {
        pdfDocument.destroy();
      }
    };
  }, [file, isOpen]);

  // Handle incoming annotation data and sync
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (data: Uint8Array, participant?: any) => {
      try {
        const messageString = new TextDecoder().decode(data);
        const messageData = JSON.parse(messageString);
        
        if (messageData.type === 'pdf_annotation_stroke' && 
            messageData.fileId === file?.id &&
            participant?.identity !== localParticipant?.identity) {
          const annotationData = messageData as PdfAnnotationData;
          if (annotationData.stroke) {
            setStrokes(prev => {
              const newStrokes = new Map(prev);
              const pageStrokes = newStrokes.get(annotationData.pageNumber) || [];
              newStrokes.set(annotationData.pageNumber, [...pageStrokes, annotationData.stroke!]);
              return newStrokes;
            });
          }
        } else if (messageData.type === 'pdf_annotation_clear' && 
                   messageData.fileId === file?.id &&
                   participant?.identity !== localParticipant?.identity) {
          const annotationData = messageData as PdfAnnotationData;
          setStrokes(prev => {
            const newStrokes = new Map(prev);
            newStrokes.set(annotationData.pageNumber, []);
            return newStrokes;
          });
          toast('Annotations cleared', { icon: '🧹' });
        } else if (messageData.type === 'pdf_page_change' && 
                   messageData.fileId === file?.id &&
                   messageData.isHost &&
                   participant?.identity !== localParticipant?.identity) {
          // Host changed page - sync for guests
          const annotationData = messageData as PdfAnnotationData;
          setCurrentPage(annotationData.pageNumber);
          toast(`Host navigated to page ${annotationData.pageNumber}`, { 
            icon: '📄',
            duration: 2000 
          });
        } else if (messageData.type === 'pdf_scroll_sync' && 
                   messageData.fileId === file?.id &&
                   messageData.isHost &&
                   participant?.identity !== localParticipant?.identity) {
          // Host scrolled - sync scroll position for guests
          const annotationData = messageData as PdfAnnotationData;
          if (canvasContainerRef.current && 
              typeof annotationData.scrollTop === 'number' && 
              typeof annotationData.scrollLeft === 'number') {
            canvasContainerRef.current.scrollTop = annotationData.scrollTop;
            canvasContainerRef.current.scrollLeft = annotationData.scrollLeft;
          }
        }
      } catch (error) {
        console.error('Error parsing PDF annotation data:', error);
      }
    };

    room.on('dataReceived', handleDataReceived);
    
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, file, localParticipant]);

  // Handle scroll synchronization - Host broadcasts scroll position to guests
  useEffect(() => {
    if (!isHost || !room || !canvasContainerRef.current || !file) return;

    const container = canvasContainerRef.current;
    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      // Debounce scroll events to avoid flooding the network
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (!localParticipant || !file) return;

        const scrollData: PdfAnnotationData = {
          type: 'pdf_scroll_sync',
          fileId: file.id,
          pageNumber: currentPage,
          scrollTop: container.scrollTop,
          scrollLeft: container.scrollLeft,
          sender: localParticipant.identity,
          timestamp: Date.now(),
          id: `scroll-${Date.now()}`,
          isHost: true,
        };

        const encodedData = new TextEncoder().encode(JSON.stringify(scrollData));
        room.localParticipant.publishData(encodedData, { topic: 'pdf-scroll' });
      }, 100); // 100ms debounce
    };

    container.addEventListener('scroll', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [isHost, room, localParticipant, file, currentPage]);

  const loadPdf = async () => {
    if (!file) return;
    
    setIsLoading(true);
    try {
      // Use the API route to serve the file, which correctly resolves room name from fileId
      const url = `/api/room-files/view/${file.id}`;
      const loadingTask = pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;
      
      setPdfDocument(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      setStrokes(new Map()); // Reset annotations when loading new PDF
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('Failed to load PDF');
    } finally {
      setIsLoading(false);
    }
  };

  // Render current page
  useEffect(() => {
    if (pdfDocument && pdfCanvasRef.current) {
      renderPage(currentPage);
    }
  }, [pdfDocument, currentPage, zoom]);

  // Redraw annotations when page or strokes change
  useEffect(() => {
    redrawAnnotations();
  }, [currentPage, strokes]);

  const renderPage = async (pageNum: number) => {
    if (!pdfDocument || !pdfCanvasRef.current) return;
    
    try {
      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: zoom });
      
      const canvas = pdfCanvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Also size annotation canvas
      if (annotationCanvasRef.current) {
        annotationCanvasRef.current.width = viewport.width;
        annotationCanvasRef.current.height = viewport.height;
      }
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      await page.render(renderContext).promise;
      redrawAnnotations();
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  };

  const redrawAnnotations = () => {
    if (!annotationCanvasRef.current) return;
    
    const canvas = annotationCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get strokes for current page
    const pageStrokes = strokes.get(currentPage) || [];
    
    // Draw all strokes
    pageStrokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === 'eraser' ? 'rgba(255, 255, 255, 1)' : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.3;
      } else {
        ctx.globalAlpha = 1.0;
      }
      
      const firstPoint = stroke.points[0];
      ctx.moveTo(firstPoint.x, firstPoint.y);
      
      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i];
        ctx.lineTo(point.x, point.y);
      }
      
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    });
    
    // Draw current stroke if drawing
    if (currentStroke && currentStroke.points.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = currentStroke.tool === 'eraser' ? 'rgba(255, 255, 255, 1)' : currentStroke.color;
      ctx.lineWidth = currentStroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (currentStroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.3;
      }
      
      const firstPoint = currentStroke.points[0];
      ctx.moveTo(firstPoint.x, firstPoint.y);
      
      for (let i = 1; i < currentStroke.points.length; i++) {
        const point = currentStroke.points[i];
        ctx.lineTo(point.x, point.y);
      }
      
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): DrawingPoint => {
    if (!annotationCanvasRef.current) return { x: 0, y: 0 };
    
    const rect = annotationCanvasRef.current.getBoundingClientRect();
    const scaleX = annotationCanvasRef.current.width / rect.width;
    const scaleY = annotationCanvasRef.current.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const pos = getMousePos(e);
    
    const newStroke: DrawingStroke = {
      id: `${Date.now()}-${Math.random()}`,
      points: [pos],
      color: currentTool === 'eraser' ? '#FFFFFF' : currentColor,
      width: currentTool === 'highlighter' ? currentWidth * 3 : currentWidth,
      tool: currentTool,
    };
    
    setCurrentStroke(newStroke);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStroke) return;
    
    const pos = getMousePos(e);
    const updatedStroke = {
      ...currentStroke,
      points: [...currentStroke.points, pos],
    };
    
    setCurrentStroke(updatedStroke);
    redrawAnnotations();
  };

  const stopDrawing = async () => {
    if (!currentStroke || !localParticipant) return;
    
    setIsDrawing(false);
    
    // Add stroke to current page
    setStrokes(prev => {
      const newStrokes = new Map(prev);
      const pageStrokes = newStrokes.get(currentPage) || [];
      newStrokes.set(currentPage, [...pageStrokes, currentStroke]);
      return newStrokes;
    });
    
    // Broadcast stroke to other participants
    const annotationData: PdfAnnotationData = {
      type: 'pdf_annotation_stroke',
      fileId: file!.id,
      pageNumber: currentPage,
      stroke: currentStroke,
      sender: localParticipant.identity,
      timestamp: Date.now(),
      id: currentStroke.id,
    };
    
    const encodedData = new TextEncoder().encode(JSON.stringify(annotationData));
    await room.localParticipant.publishData(encodedData, { topic: 'pdf-annotation' });
    
    setCurrentStroke(null);
  };

  const clearAnnotations = async () => {
    if (!localParticipant) return;
    
    setStrokes(prev => {
      const newStrokes = new Map(prev);
      newStrokes.set(currentPage, []);
      return newStrokes;
    });
    
    // Broadcast clear to other participants
    const annotationData: PdfAnnotationData = {
      type: 'pdf_annotation_clear',
      fileId: file!.id,
      pageNumber: currentPage,
      sender: localParticipant.identity,
      timestamp: Date.now(),
      id: `clear-${Date.now()}`,
    };
    
    const encodedData = new TextEncoder().encode(JSON.stringify(annotationData));
    await room.localParticipant.publishData(encodedData, { topic: 'pdf-annotation' });
    
    toast.success('Annotations cleared');
  };

  const handlePageChange = async (newPage: number) => {
    setCurrentPage(newPage);
    
    // If host, broadcast page change to all participants
    if (isHost && localParticipant && file) {
      const pageChangeData: PdfAnnotationData = {
        type: 'pdf_page_change',
        fileId: file.id,
        pageNumber: newPage,
        sender: localParticipant.identity,
        timestamp: Date.now(),
        id: `page-change-${Date.now()}`,
        isHost: true,
      };
      
      const encodedData = new TextEncoder().encode(JSON.stringify(pageChangeData));
      await room.localParticipant.publishData(encodedData, { topic: 'pdf-annotation' });
    }
  };

  const downloadAnnotatedPage = () => {
    if (!pdfCanvasRef.current || !annotationCanvasRef.current) return;
    
    // Create a temporary canvas to combine both layers
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    tempCanvas.width = pdfCanvasRef.current.width;
    tempCanvas.height = pdfCanvasRef.current.height;
    
    // Draw PDF layer
    tempCtx.drawImage(pdfCanvasRef.current, 0, 0);
    // Draw annotation layer
    tempCtx.drawImage(annotationCanvasRef.current, 0, 0);
    
    // Download
    const link = document.createElement('a');
    link.download = `${file?.originalName}-page-${currentPage}-annotated.png`;
    link.href = tempCanvas.toDataURL();
    link.click();
    
    toast.success('Page downloaded');
  };

  if (!isOpen || !mounted || !file) return null;

  const content = (
    <div className={styles.pdfViewerOverlay}>
      <div className={styles.pdfViewerContainer}>
        {/* Header */}
        <div className={styles.header}>
          <h3 className={styles.title}>📄 {file.originalName}</h3>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          {/* Page Navigation */}
          <div className={styles.toolGroup}>
            <button
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className={styles.toolButton}
              title="Previous page"
            >
              ◀️
            </button>
            <span className={styles.pageInfo}>
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className={styles.toolButton}
              title="Next page"
            >
              ▶️
            </button>
          </div>

          {/* Zoom Controls */}
          <div className={styles.toolGroup}>
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              className={styles.toolButton}
            >
              🔍-
            </button>
            <span className={styles.zoomInfo}>{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(2.0, z + 0.25))}
              className={styles.toolButton}
            >
              🔍+
            </button>
          </div>

          {/* Drawing Tools */}
          <div className={styles.toolGroup}>
            <button
              onClick={() => setCurrentTool('pen')}
              className={`${styles.toolButton} ${currentTool === 'pen' ? styles.active : ''}`}
            >
              ✏️
            </button>
            <button
              onClick={() => setCurrentTool('highlighter')}
              className={`${styles.toolButton} ${currentTool === 'highlighter' ? styles.active : ''}`}
            >
              🖍️
            </button>
            <button
              onClick={() => setCurrentTool('eraser')}
              className={`${styles.toolButton} ${currentTool === 'eraser' ? styles.active : ''}`}
            >
              🧽
            </button>
          </div>

          {/* Colors */}
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

          {/* Brush Sizes */}
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

          {/* Actions */}
          <div className={styles.toolGroup}>
            <button onClick={clearAnnotations} className={styles.toolButton}>
              🗑️
            </button>
            <button onClick={downloadAnnotatedPage} className={styles.toolButton}>
              💾
            </button>
          </div>
        </div>

        {/* PDF Canvas */}
        <div className={styles.canvasContainer} ref={canvasContainerRef}>
          {isLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <span>Loading PDF...</span>
            </div>
          ) : (
            <div className={styles.canvasWrapper}>
              <canvas ref={pdfCanvasRef} className={styles.pdfCanvas} />
              <canvas
                ref={annotationCanvasRef}
                className={styles.annotationCanvas}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}


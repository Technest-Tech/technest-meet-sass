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
  const textLayerRef = useRef<HTMLDivElement>(null);
  
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lastPageChangeTimestamp, setLastPageChangeTimestamp] = useState(0);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = useState('#FF0000');
  const [currentWidth, setCurrentWidth] = useState(4);
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);
  
  // Stroke storage per page
  const [strokes, setStrokes] = useState<Map<number, DrawingStroke[]>>(new Map());
  
  // Guest drawing restriction
  const [preventGuestDrawing, setPreventGuestDrawing] = useState(false);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  
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
            // Store stroke with sender information
            const strokeWithSender = {
              ...annotationData.stroke,
              sender: annotationData.sender
            };
            setStrokes(prev => {
              const newStrokes = new Map(prev);
              const pageStrokes = newStrokes.get(annotationData.pageNumber) || [];
              newStrokes.set(annotationData.pageNumber, [...pageStrokes, strokeWithSender]);
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
        } else if (messageData.type === 'pdf_annotation_delete_host' && 
                   messageData.fileId === file?.id) {
          const annotationData = messageData as PdfAnnotationData;
          // Only process if it's from another participant (not our own message)
          if (participant?.identity !== localParticipant?.identity) {
            setStrokes(prev => {
              const newStrokes = new Map(prev);
              const pageStrokes = newStrokes.get(annotationData.pageNumber) || [];
              // Remove strokes where sender contains '_host_'
              const filteredStrokes = pageStrokes.filter(stroke => 
                !stroke.sender || !stroke.sender.toLowerCase().includes('_host_')
              );
              newStrokes.set(annotationData.pageNumber, filteredStrokes);
              return newStrokes;
            });
            // Force redraw after state update
            setTimeout(() => {
              if (annotationCanvasRef.current) {
                redrawAnnotations();
              }
            }, 0);
            toast('Host drawings deleted', { icon: '🗑️' });
          }
        } else if (messageData.type === 'pdf_annotation_delete_guest' && 
                   messageData.fileId === file?.id) {
          const annotationData = messageData as PdfAnnotationData;
          // Only process if it's from another participant (not our own message)
          if (participant?.identity !== localParticipant?.identity) {
            setStrokes(prev => {
              const newStrokes = new Map(prev);
              const pageStrokes = newStrokes.get(annotationData.pageNumber) || [];
              // Keep only strokes where sender contains '_host_' (host strokes)
              // Remove strokes where sender does NOT contain '_host_' (guest/student strokes)
              const filteredStrokes = pageStrokes.filter(stroke => {
                if (!stroke.sender) return false; // Remove strokes without sender
                return stroke.sender.toLowerCase().includes('_host_');
              });
              newStrokes.set(annotationData.pageNumber, filteredStrokes);
              return newStrokes;
            });
            toast('Student drawings deleted', { icon: '🗑️' });
          }
        } else if (messageData.type === 'pdf_annotation_delete_all' && 
                   messageData.fileId === file?.id) {
          const annotationData = messageData as PdfAnnotationData;
          // Only process if it's from another participant (not our own message)
          if (participant?.identity !== localParticipant?.identity) {
            setStrokes(prev => {
              const newStrokes = new Map(prev);
              newStrokes.set(annotationData.pageNumber, []);
              return newStrokes;
            });
            toast('All drawings deleted', { icon: '🗑️' });
          }
        } else if (messageData.type === 'pdf_prevent_guest_drawing' && 
                   messageData.fileId === file?.id &&
                   participant?.identity !== localParticipant?.identity) {
          const annotationData = messageData as PdfAnnotationData;
          if (typeof annotationData.preventGuestDrawing === 'boolean') {
            setPreventGuestDrawing(annotationData.preventGuestDrawing);
          }
        } else if (messageData.type === 'pdf_page_change' && 
                   messageData.fileId === file?.id &&
                   messageData.isHost &&
                   participant?.identity !== localParticipant?.identity) {
          // Host changed page - sync for guests
          const annotationData = messageData as PdfAnnotationData;
          
          // Validate page number
          if (typeof annotationData.pageNumber !== 'number' || 
              annotationData.pageNumber < 1) {
            console.warn('Invalid page number received:', annotationData.pageNumber);
            return;
          }
          
          // Only process if we have totalPages loaded, or if page number seems reasonable
          if (totalPages > 0 && annotationData.pageNumber > totalPages) {
            console.warn('Page number exceeds total pages:', annotationData.pageNumber, '>', totalPages);
            return;
          }
          
          // Handle out-of-order messages by checking timestamp
          // Only update if this message is newer than the last one we processed
          if (!annotationData.timestamp || annotationData.timestamp > lastPageChangeTimestamp) {
            setLastPageChangeTimestamp(annotationData.timestamp || Date.now());
            // Update current page - the useEffect will handle rendering
            setCurrentPage(annotationData.pageNumber);
            
            toast(`Host navigated to page ${annotationData.pageNumber}`, { 
              icon: '📄',
              duration: 2000 
            });
          } else {
            // Ignore out-of-order message
            console.log('Ignoring out-of-order page change message:', annotationData.timestamp, '<=', lastPageChangeTimestamp);
          }
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
  }, [room, file, localParticipant, totalPages, lastPageChangeTimestamp, pdfDocument]);

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
      const loadingTask = pdfjsLib.getDocument({
        url: url,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/',
        useSystemFonts: false, // Important: use embedded fonts from PDF
        disableFontFace: false, // Important: allow font loading
        verbosity: 0,
        // Additional options for better rendering
        disableAutoFetch: false,
        disableStream: false,
        disableRange: false,
        maxImageSize: 1024 * 1024 * 10, // 10MB
        isEvalSupported: false,
      });
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
      // Small delay to ensure container is sized correctly on mobile
      const timer = setTimeout(() => {
        renderPage(currentPage);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pdfDocument, currentPage, zoom]);
  
  // Re-render on window resize for mobile orientation changes
  useEffect(() => {
    if (!pdfDocument || !isOpen) return;
    
    const handleResize = () => {
      if (pdfDocument && pdfCanvasRef.current) {
        renderPage(currentPage);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pdfDocument, currentPage, isOpen]);

  // Redraw annotations when page or strokes change
  useEffect(() => {
    redrawAnnotations();
  }, [currentPage, strokes, preventGuestDrawing]);

  const renderPage = async (pageNum: number) => {
    if (!pdfDocument || !pdfCanvasRef.current) return;
    
    try {
      const page = await pdfDocument.getPage(pageNum);
      
      // Calculate responsive scale for mobile
      let scale = zoom;
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        // On mobile, adjust scale to fit screen width
        const containerWidth = canvasContainerRef.current?.clientWidth || window.innerWidth - 20;
        const baseViewport = page.getViewport({ scale: 1.0 });
        const maxScale = Math.min(zoom, (containerWidth - 20) / baseViewport.width);
        scale = Math.max(0.5, maxScale);
      }
      
      const viewport = page.getViewport({ scale });
      
      const canvas = pdfCanvasRef.current;
      // Configure canvas context with better text rendering options
      const context = canvas.getContext('2d', {
        alpha: false, // Better performance and text rendering
        desynchronized: false,
        willReadFrequently: false,
      });
      if (!context) return;
      
      // Set canvas size with device pixel ratio for crisp rendering
      const outputScale = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      
      // Scale context to match device pixel ratio
      context.scale(outputScale, outputScale);
      
      // Configure context for better text rendering
      context.textBaseline = 'bottom';
      context.textAlign = 'left';
      // Enable better text rendering quality
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      
      // Also size annotation canvas
      if (annotationCanvasRef.current) {
        annotationCanvasRef.current.width = Math.floor(viewport.width * outputScale);
        annotationCanvasRef.current.height = Math.floor(viewport.height * outputScale);
        annotationCanvasRef.current.style.width = `${viewport.width}px`;
        annotationCanvasRef.current.style.height = `${viewport.height}px`;
        const annotationContext = annotationCanvasRef.current.getContext('2d');
        if (annotationContext) {
          annotationContext.scale(outputScale, outputScale);
        }
      }
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        // Add rendering options for better text handling
        transform: null,
        background: null,
        intent: 'display', // Use 'display' for better text rendering (important for Arabic)
      };
      
      // Render the page
      await page.render(renderContext).promise;
      
      // Render text layer for perfect text rendering (like browser PDF viewers)
      if (textLayerRef.current) {
        // Clear previous text layer
        textLayerRef.current.innerHTML = '';
        
        // Import text layer renderer
        const pdfjsViewer = await import('pdfjs-dist/web/pdf_viewer');
        
        const textContent = await page.getTextContent();
        const textLayerDiv = textLayerRef.current;
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        textLayerDiv.style.left = '0';
        textLayerDiv.style.top = '0';
        
        // Render text layer
        const textLayer = new pdfjsViewer.TextLayerBuilder({
          textLayerDiv: textLayerDiv,
          pageIndex: pageNum - 1,
          viewport: viewport,
        });
        
        textLayer.setTextContent(textContent);
        textLayer.render();
      }
      
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
    
    // Get canvas display size (not internal size)
    const displayWidth = canvas.clientWidth || canvas.width;
    const displayHeight = canvas.clientHeight || canvas.height;
    
    // Get strokes for current page
    const pageStrokes = strokes.get(currentPage) || [];
    
    // Helper function to convert normalized coordinates (0-1000) to screen coordinates
    const denormalizePoint = (normalizedPoint: DrawingPoint) => {
      const x = (normalizedPoint.x / 1000) * displayWidth;
      const y = (normalizedPoint.y / 1000) * displayHeight;
      return { x, y };
    };
    
    // Draw all strokes
    pageStrokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      
      // For eraser, use destination-out composite operation to actually erase
      if (stroke.tool === 'eraser') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
      }
      
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === 'eraser' ? 'rgba(0, 0, 0, 1)' : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.3;
      } else {
        ctx.globalAlpha = 1.0;
      }
      
      const firstPoint = denormalizePoint(stroke.points[0]);
      ctx.moveTo(firstPoint.x, firstPoint.y);
      
      for (let i = 1; i < stroke.points.length; i++) {
        const point = denormalizePoint(stroke.points[i]);
        ctx.lineTo(point.x, point.y);
      }
      
      ctx.stroke();
      
      // Restore composite operation for eraser
      if (stroke.tool === 'eraser') {
        ctx.restore();
      }
      
      ctx.globalAlpha = 1.0;
    });
    
    // Draw current stroke if drawing
    if (currentStroke && currentStroke.points.length >= 2) {
      // For eraser, use destination-out composite operation to actually erase
      if (currentStroke.tool === 'eraser') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
      }
      
      ctx.beginPath();
      ctx.strokeStyle = currentStroke.tool === 'eraser' ? 'rgba(0, 0, 0, 1)' : currentStroke.color;
      ctx.lineWidth = currentStroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (currentStroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.3;
      }
      
      const firstPoint = denormalizePoint(currentStroke.points[0]);
      ctx.moveTo(firstPoint.x, firstPoint.y);
      
      for (let i = 1; i < currentStroke.points.length; i++) {
        const point = denormalizePoint(currentStroke.points[i]);
        ctx.lineTo(point.x, point.y);
      }
      
      ctx.stroke();
      
      // Restore composite operation for eraser
      if (currentStroke.tool === 'eraser') {
        ctx.restore();
      }
      
      ctx.globalAlpha = 1.0;
    }
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): DrawingPoint => {
    if (!annotationCanvasRef.current) return { x: 0, y: 0 };
    
    const rect = annotationCanvasRef.current.getBoundingClientRect();
    
    let clientX: number;
    let clientY: number;
    
    if ('touches' in e && e.touches.length > 0) {
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return { x: 0, y: 0 };
    }
    
    // Calculate position in display coordinates
    const displayX = clientX - rect.left;
    const displayY = clientY - rect.top;
    
    // Normalize to 0-1 range, then scale to 0-1000 for cross-platform compatibility
    // This ensures coordinates work across different screen sizes and zoom levels
    const x = (displayX / rect.width) * 1000;
    const y = (displayY / rect.height) * 1000;
    
    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    // Check if guest drawing is prevented
    if (!isHost && preventGuestDrawing) {
      toast.error('Drawing is disabled for guests');
      return;
    }
    
    setIsDrawing(true);
    const pos = getMousePos(e);
    
    const newStroke: DrawingStroke = {
      id: `${Date.now()}-${Math.random()}`,
      points: [pos],
      color: currentTool === 'eraser' ? '#FFFFFF' : currentColor,
      width: currentTool === 'highlighter' ? currentWidth * 3 : currentWidth,
      tool: currentTool,
      sender: localParticipant?.identity || '',
    };
    
    setCurrentStroke(newStroke);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !currentStroke) return;
    
    const pos = getMousePos(e);
    const updatedStroke = {
      ...currentStroke,
      points: [...currentStroke.points, pos],
    };
    
    setCurrentStroke(updatedStroke);
    redrawAnnotations();
  };

  const stopDrawing = async (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e) {
      e.preventDefault();
    }
    if (!currentStroke || !localParticipant) return;
    
    setIsDrawing(false);
    
    // Ensure stroke has sender information
    const strokeWithSender = {
      ...currentStroke,
      sender: localParticipant.identity
    };
    
    // Add stroke to current page
    setStrokes(prev => {
      const newStrokes = new Map(prev);
      const pageStrokes = newStrokes.get(currentPage) || [];
      newStrokes.set(currentPage, [...pageStrokes, strokeWithSender]);
      return newStrokes;
    });
    
    // Broadcast stroke to other participants
    const annotationData: PdfAnnotationData = {
      type: 'pdf_annotation_stroke',
      fileId: file!.id,
      pageNumber: currentPage,
      stroke: strokeWithSender,
      sender: localParticipant.identity,
      timestamp: Date.now(),
      id: currentStroke.id,
    };
    
    const encodedData = new TextEncoder().encode(JSON.stringify(annotationData));
    await room.localParticipant.publishData(encodedData, { topic: 'pdf-annotation' });
    
    setCurrentStroke(null);
  };

  const deleteHostDrawings = async () => {
    if (!localParticipant || !isHost || !file) return;
    
    // Broadcast delete to other participants FIRST
    const annotationData: PdfAnnotationData = {
      type: 'pdf_annotation_delete_host',
      fileId: file.id,
      pageNumber: currentPage,
      sender: localParticipant.identity,
      timestamp: Date.now(),
      id: `delete-host-${Date.now()}`,
    };
    
    const encodedData = new TextEncoder().encode(JSON.stringify(annotationData));
    await room.localParticipant.publishData(encodedData, { topic: 'pdf-annotation' });
    
    // Then update local state - remove host strokes (keep only guest/student strokes)
    setStrokes(prev => {
      const newStrokes = new Map(prev);
      const pageStrokes = newStrokes.get(currentPage) || [];
      // Remove strokes where sender contains '_host_' (host strokes)
      // Keep strokes where sender does NOT contain '_host_' (guest/student strokes)
      const filteredStrokes = pageStrokes.filter(stroke => {
        if (!stroke.sender) return true; // Keep strokes without sender (legacy)
        return !stroke.sender.toLowerCase().includes('_host_');
      });
      newStrokes.set(currentPage, filteredStrokes);
      return newStrokes;
    });
    
    toast.success('Host drawings deleted');
    setShowDeleteOptions(false);
  };

  const deleteGuestDrawings = async () => {
    if (!localParticipant || !isHost || !file) return;
    
    // Broadcast delete to other participants FIRST
    const annotationData: PdfAnnotationData = {
      type: 'pdf_annotation_delete_guest',
      fileId: file.id,
      pageNumber: currentPage,
      sender: localParticipant.identity,
      timestamp: Date.now(),
      id: `delete-guest-${Date.now()}`,
    };
    
    const encodedData = new TextEncoder().encode(JSON.stringify(annotationData));
    await room.localParticipant.publishData(encodedData, { topic: 'pdf-annotation' });
    
    // Then update local state - remove guest/student strokes (keep only host strokes)
    setStrokes(prev => {
      const newStrokes = new Map(prev);
      const pageStrokes = newStrokes.get(currentPage) || [];
      // Keep only strokes where sender contains '_host_' (host strokes)
      // Remove all strokes where sender does NOT contain '_host_' (guest/student strokes)
      const filteredStrokes = pageStrokes.filter(stroke => {
        if (!stroke.sender) return false; // Remove strokes without sender
        return stroke.sender.toLowerCase().includes('_host_');
      });
      newStrokes.set(currentPage, filteredStrokes);
      return newStrokes;
    });
    
    toast.success('Student drawings deleted');
    setShowDeleteOptions(false);
  };

  const deleteAllDrawings = async () => {
    if (!localParticipant || !isHost || !file) return;
    
    // Broadcast delete to other participants FIRST
    const annotationData: PdfAnnotationData = {
      type: 'pdf_annotation_delete_all',
      fileId: file.id,
      pageNumber: currentPage,
      sender: localParticipant.identity,
      timestamp: Date.now(),
      id: `delete-all-${Date.now()}`,
    };
    
    const encodedData = new TextEncoder().encode(JSON.stringify(annotationData));
    await room.localParticipant.publishData(encodedData, { topic: 'pdf-annotation' });
    
    // Then update local state - remove all strokes
    setStrokes(prev => {
      const newStrokes = new Map(prev);
      newStrokes.set(currentPage, []);
      return newStrokes;
    });
    
    toast.success('All drawings deleted');
    setShowDeleteOptions(false);
  };

  const toggleGuestDrawing = async () => {
    if (!localParticipant || !isHost) return;
    
    const newState = !preventGuestDrawing;
    setPreventGuestDrawing(newState);
    
    // Broadcast state change to all participants
    const annotationData: PdfAnnotationData = {
      type: 'pdf_prevent_guest_drawing',
      fileId: file!.id,
      pageNumber: currentPage,
      sender: localParticipant.identity,
      timestamp: Date.now(),
      id: `prevent-guest-${Date.now()}`,
      preventGuestDrawing: newState,
    };
    
    const encodedData = new TextEncoder().encode(JSON.stringify(annotationData));
    await room.localParticipant.publishData(encodedData, { topic: 'pdf-annotation' });
    
    toast.success(newState ? 'Guest drawing disabled' : 'Guest drawing enabled');
  };

  const handlePageChange = async (newPage: number) => {
    // Validate page number
    if (newPage < 1 || newPage > totalPages) {
      console.warn('Invalid page number:', newPage);
      return;
    }
    
    const timestamp = Date.now();
    setLastPageChangeTimestamp(timestamp);
    setCurrentPage(newPage);
    
    // If host, broadcast page change to all participants
    if (isHost && localParticipant && file) {
      const pageChangeData: PdfAnnotationData = {
        type: 'pdf_page_change',
        fileId: file.id,
        pageNumber: newPage,
        sender: localParticipant.identity,
        timestamp: timestamp,
        id: `page-change-${timestamp}`,
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
          <button 
            className={styles.closeButton} 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          {/* Page Navigation */}
          <div className={styles.toolGroup}>
            <button
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              onTouchEnd={(e) => {
                e.preventDefault();
                if (currentPage > 1) {
                  handlePageChange(Math.max(1, currentPage - 1));
                }
              }}
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
              onTouchEnd={(e) => {
                e.preventDefault();
                if (currentPage < totalPages) {
                  handlePageChange(Math.min(totalPages, currentPage + 1));
                }
              }}
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
              onClick={() => {
                if (!isHost && preventGuestDrawing) {
                  toast.error('Drawing is disabled for guests');
                  return;
                }
                setCurrentTool('pen');
              }}
              className={`${styles.toolButton} ${currentTool === 'pen' ? styles.active : ''}`}
              disabled={!isHost && preventGuestDrawing}
              title={!isHost && preventGuestDrawing ? 'Drawing disabled' : 'Pen'}
            >
              ✏️
            </button>
            <button
              onClick={() => {
                if (!isHost && preventGuestDrawing) {
                  toast.error('Drawing is disabled for guests');
                  return;
                }
                setCurrentTool('highlighter');
              }}
              className={`${styles.toolButton} ${currentTool === 'highlighter' ? styles.active : ''}`}
              disabled={!isHost && preventGuestDrawing}
              title={!isHost && preventGuestDrawing ? 'Drawing disabled' : 'Highlighter'}
            >
              🖍️
            </button>
            <button
              onClick={() => {
                if (!isHost && preventGuestDrawing) {
                  toast.error('Drawing is disabled for guests');
                  return;
                }
                setCurrentTool('eraser');
              }}
              className={`${styles.toolButton} ${currentTool === 'eraser' ? styles.active : ''}`}
              disabled={!isHost && preventGuestDrawing}
              title={!isHost && preventGuestDrawing ? 'Drawing disabled' : 'Eraser'}
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
            {isHost && (
              <button 
                onClick={toggleGuestDrawing} 
                className={`${styles.toolButton} ${preventGuestDrawing ? styles.active : ''}`}
                title={preventGuestDrawing ? 'Enable guest drawing' : 'Disable guest drawing'}
              >
                {preventGuestDrawing ? '🚫' : '✏️'}
              </button>
            )}
            {isHost ? (
              <button 
                onClick={() => setShowDeleteOptions(true)} 
                className={styles.toolButton}
                title="Delete drawings"
              >
                🗑️
              </button>
            ) : (
              <button 
                onClick={() => {
                  if (!preventGuestDrawing) {
                    setStrokes(prev => {
                      const newStrokes = new Map(prev);
                      newStrokes.set(currentPage, []);
                      return newStrokes;
                    });
                    toast.success('Annotations cleared');
                  } else {
                    toast.error('Drawing is disabled for guests');
                  }
                }}
                className={styles.toolButton}
                disabled={preventGuestDrawing}
                title="Clear annotations"
              >
                🗑️
              </button>
            )}
            <button onClick={downloadAnnotatedPage} className={styles.toolButton}>
              💾
            </button>
          </div>
        </div>

        {/* Delete Options Modal */}
        {showDeleteOptions && isHost && (
          <div className={styles.modalOverlay} onClick={() => setShowDeleteOptions(false)}>
            <div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Delete Drawings</h3>
                <button 
                  className={styles.modalCloseButton}
                  onClick={() => setShowDeleteOptions(false)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.modalContent}>
                <button 
                  className={styles.deleteOption}
                  onClick={deleteHostDrawings}
                  title="Delete only your drawings"
                >
                  <span className={styles.deleteIcon}>👤</span>
                  <span>My Drawings Only</span>
                </button>
                <button 
                  className={styles.deleteOption}
                  onClick={deleteHostDrawings}
                  title="Delete host drawings, keep student drawings"
                >
                  <span className={styles.deleteIcon}>👤</span>
                  <span>Keep Student Drawings</span>
                </button>
                <button 
                  className={styles.deleteOption}
                  onClick={deleteGuestDrawings}
                  title="Delete only student/guest drawings"
                >
                  <span className={styles.deleteIcon}>👥</span>
                  <span>Student Drawings Only</span>
                </button>
                <button 
                  className={styles.deleteOption}
                  onClick={deleteAllDrawings}
                  title="Delete all drawings"
                >
                  <span className={styles.deleteIcon}>🗑️</span>
                  <span>All Drawings</span>
                </button>
              </div>
            </div>
          </div>
        )}

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
              {/* Text layer for perfect text rendering */}
              <div 
                ref={textLayerRef} 
                className={styles.textLayer}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                  overflow: 'hidden',
                  opacity: 1,
                  lineHeight: 1,
                  textSizeAdjust: '100%',
                  forcedColorAdjust: 'none',
                  transformOrigin: '0% 0%',
                }}
              />
              <canvas
                ref={annotationCanvasRef}
                className={styles.annotationCanvas}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{ touchAction: 'none' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}


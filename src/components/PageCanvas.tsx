import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { renderPageToCanvas, renderTextLayer } from '../utils/pdfUtils';
import { usePDF } from '../contexts/PDFContext';
import type { Annotation } from '../types/pdf';
import './PageCanvas.css';

interface PageCanvasProps {
  page: PDFPageProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
}

export function PageCanvas({ page, pageNumber, scale, rotation }: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const annotationLayerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const renderTaskRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    state,
    currentTool,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    searchHighlight,
  } = usePDF();

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrawing, setCurrentDrawing] = useState<Partial<Annotation> | null>(null);
  // Use ref for current drawing to avoid stale closure issues in mouse up handler
  const currentDrawingRef = useRef<Partial<Annotation> | null>(null);
  // Use ref for drawing points to avoid stale closure issues in mouse move handler
  const drawingPointsRef = useRef<{ x: number; y: number }[]>([]);

  // Inline text editing state
  const [textInputPosition, setTextInputPosition] = useState<{ x: number; y: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');
  const [textInputSize, setTextInputSize] = useState<{ width: number; height: number }>({ width: 150, height: 30 });
  const [textInputFontSize, setTextInputFontSize] = useState(16);
  const [textInputFontFamily, setTextInputFontFamily] = useState('Inter, sans-serif');
  const [textInputColor, setTextInputColor] = useState('#000000');
  const [textInputBgColor, setTextInputBgColor] = useState<string | undefined>(undefined);
  const [textInputBgOpacity, setTextInputBgOpacity] = useState(100);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const textInputContainerRef = useRef<HTMLDivElement>(null);
  const [textInputResizing, setTextInputResizing] = useState<string | null>(null);

  // Annotation dragging state
  const [draggingAnnotation, setDraggingAnnotation] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Selected annotation state
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  // Resize state
  const [resizing, setResizing] = useState<{ annotationId: string; handle: string } | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Get page-specific rotation
  const pageRotation = state.pageRotations.get(pageNumber) || 0;
  const totalRotation = (rotation + pageRotation) % 360;

  // Get unrotated page dimensions for coordinate transformation
  const unrotatedViewport = page.getViewport({ scale: 1, rotation: 0 });
  const pageWidth = unrotatedViewport.width;
  const pageHeight = unrotatedViewport.height;

  // Transform screen coordinates to page coordinates (unrotated space)
  // This is used when storing annotations so they're rotation-independent
  const screenToPageCoords = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      // Screen coordinates are in the rotated viewport space
      // Page coordinates are in the original unrotated page space
      switch (totalRotation) {
        case 90:
          // 90° CW: screen (sx, sy) -> page (pageWidth - sy, sx)
          return { x: pageWidth - screenY, y: screenX };
        case 180:
          return { x: pageWidth - screenX, y: pageHeight - screenY };
        case 270:
          // 270° CW: screen (sx, sy) -> page (sy, pageHeight - sx)
          return { x: screenY, y: pageHeight - screenX };
        default: // 0
          return { x: screenX, y: screenY };
      }
    },
    [totalRotation, pageWidth, pageHeight]
  );

  // Transform page coordinates to screen coordinates (rotated space)
  // This is used when rendering annotations
  const pageToScreenCoords = useCallback(
    (pageX: number, pageY: number): { x: number; y: number } => {
      switch (totalRotation) {
        case 90:
          // 90° CW: page (px, py) -> screen (py, pageWidth - px)
          return { x: pageY, y: pageWidth - pageX };
        case 180:
          return { x: pageWidth - pageX, y: pageHeight - pageY };
        case 270:
          // 270° CW: page (px, py) -> screen (pageHeight - py, px)
          return { x: pageHeight - pageY, y: pageX };
        default: // 0
          return { x: pageX, y: pageY };
      }
    },
    [totalRotation, pageWidth, pageHeight]
  );

  // Helper to update both state and ref for current drawing
  const updateCurrentDrawing = useCallback((drawing: Partial<Annotation> | null) => {
    currentDrawingRef.current = drawing;
    setCurrentDrawing(drawing);
  }, []);

  // Render PDF page and text layer
  useEffect(() => {
    const canvas = canvasRef.current;
    const textLayer = textLayerRef.current;
    if (!canvas || !page) return;

    // Debounce rendering to avoid flickering
    if (renderTaskRef.current) {
      clearTimeout(renderTaskRef.current);
    }

    renderTaskRef.current = setTimeout(async () => {
      setIsRendering(true);
      try {
        await renderPageToCanvas(page, canvas, scale, totalRotation);
        // Use CSS dimensions (logical size) not canvas dimensions (high-res)
        setDimensions({
          width: parseFloat(canvas.style.width) || canvas.width,
          height: parseFloat(canvas.style.height) || canvas.height,
        });

        // Render text layer for text selection (when select tool is active)
        if (textLayer) {
          await renderTextLayer(page, textLayer, scale, totalRotation);
        }
      } catch (error) {
        console.error('Error rendering page:', error);
      } finally {
        setIsRendering(false);
      }
    }, 50);

    return () => {
      if (renderTaskRef.current) {
        clearTimeout(renderTaskRef.current);
      }
    };
  }, [page, scale, totalRotation]);

  // Highlight search results in text layer
  useEffect(() => {
    const textLayer = textLayerRef.current;
    if (!textLayer || isRendering) return;

    // Clear previous highlights
    textLayer.querySelectorAll('.search-highlight-mark').forEach(el => {
      el.classList.remove('search-highlight-mark');
    });

    // If this page has a search highlight
    if (searchHighlight && searchHighlight.pageNumber === pageNumber) {
      const term = searchHighlight.term.toLowerCase();
      const spans = Array.from(textLayer.querySelectorAll('span'));
      let matchCount = 0;

      for (const span of spans) {
        const text = span.textContent?.toLowerCase() || '';
        if (text.includes(term)) {
          if (matchCount === searchHighlight.matchIndex) {
            span.classList.add('search-highlight-mark');
            // Scroll the span into view after a brief delay to ensure rendering is complete
            setTimeout(() => {
              span.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
            break;
          }
          matchCount++;
        }
      }
    }
  }, [searchHighlight, pageNumber, isRendering]);

  // Get coordinates relative to canvas - works with both React and native events
  const getCoordinates = useCallback(
    (e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    },
    [scale]
  );

  // Get coordinates from touch events
  const getTouchCoordinates = useCallback(
    (e: React.TouchEvent | TouchEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas || !e.touches[0]) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) / scale,
        y: (touch.clientY - rect.top) / scale,
      };
    },
    [scale]
  );

  // Check if current tool is a drawing tool (needs touch handling)
  const isDrawingTool = currentTool !== 'select' && currentTool !== 'pan';

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (currentTool === 'select' || currentTool === 'pan') return;
      // Don't start drawing if text input is open
      if (currentTool === 'text' && textInputPosition) return;

      const coords = getCoordinates(e);
      setIsDrawing(true);
      setDrawStart(coords);

      // Initialize currentDrawing for all tools to avoid stale state issues
      if (currentTool === 'draw') {
        drawingPointsRef.current = [coords];
        updateCurrentDrawing({
          type: 'drawing',
          pageNumber,
          x: 0,
          y: 0,
          points: [coords],
          color: '#ff0000',
        });
      } else if (currentTool === 'arrow') {
        updateCurrentDrawing({
          type: 'arrow',
          pageNumber,
          x: coords.x,
          y: coords.y,
          points: [coords, coords],
          color: '#ff0000',
        });
      } else if (currentTool === 'highlight' || currentTool === 'rectangle' || currentTool === 'circle') {
        updateCurrentDrawing({
          type: currentTool,
          pageNumber,
          x: coords.x,
          y: coords.y,
          width: 0,
          height: 0,
          color: currentTool === 'highlight' ? 'rgba(255, 255, 0, 0.4)' : '#ff0000',
        });
      }
    },
    [currentTool, getCoordinates, pageNumber, updateCurrentDrawing, textInputPosition]
  );

  const handleMouseUp = useCallback(() => {
    // Use ref to get latest value, avoiding stale closure issues
    const drawing = currentDrawingRef.current;

    if (!isDrawing || !drawing) {
      setIsDrawing(false);
      setDrawStart(null);
      updateCurrentDrawing(null);
      drawingPointsRef.current = [];
      return;
    }

    // Only add if the drawing has some size
    const hasSize =
      drawing.type === 'drawing'
        ? (drawing.points?.length || 0) > 2
        : drawing.type === 'arrow'
        ? true
        : (drawing.width || 0) > 5 && (drawing.height || 0) > 5;

    if (hasSize) {
      // Convert screen coordinates to page coordinates for storage
      // This ensures annotations stay in the correct position regardless of rotation
      let annotationToSave: Omit<Annotation, 'id'>;

      if (drawing.type === 'drawing' && drawing.points) {
        // Transform all points for freeform drawing
        const transformedPoints = drawing.points.map(p => screenToPageCoords(p.x, p.y));
        annotationToSave = {
          ...drawing,
          points: transformedPoints,
        } as Omit<Annotation, 'id'>;
      } else if (drawing.type === 'arrow' && drawing.points) {
        // Transform arrow endpoints
        const transformedPoints = drawing.points.map(p => screenToPageCoords(p.x, p.y));
        annotationToSave = {
          ...drawing,
          x: transformedPoints[0].x,
          y: transformedPoints[0].y,
          points: transformedPoints,
        } as Omit<Annotation, 'id'>;
      } else {
        // Transform position for shapes (highlight, rectangle, circle)
        // Store the CENTER of the annotation - this is rotation-invariant
        const screenX = drawing.x || 0;
        const screenY = drawing.y || 0;
        const screenW = drawing.width || 0;
        const screenH = drawing.height || 0;

        // Calculate screen center
        const screenCenterX = screenX + screenW / 2;
        const screenCenterY = screenY + screenH / 2;

        // Transform center to page coordinates
        const pageCenter = screenToPageCoords(screenCenterX, screenCenterY);

        // Swap dimensions for 90/270 rotations
        const pageDims = (totalRotation === 90 || totalRotation === 270)
          ? { width: screenH, height: screenW }
          : { width: screenW, height: screenH };

        // Store center position and dimensions
        // We use negative width/height as a marker that this uses center-based storage
        // Actually, let's store as top-left by computing from center
        annotationToSave = {
          ...drawing,
          x: pageCenter.x - pageDims.width / 2,
          y: pageCenter.y - pageDims.height / 2,
          width: pageDims.width,
          height: pageDims.height,
        } as Omit<Annotation, 'id'>;
      }

      addAnnotation(annotationToSave);
    }

    setIsDrawing(false);
    setDrawStart(null);
    updateCurrentDrawing(null);
    drawingPointsRef.current = [];
  }, [isDrawing, addAnnotation, screenToPageCoords, totalRotation, updateCurrentDrawing]);

  // Use document-level event listeners when drawing to ensure reliable capture
  useEffect(() => {
    if (!isDrawing) return;

    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (!drawStart) return;

      const coords = getCoordinates(e);
      const tool = currentTool;

      if (tool === 'draw') {
        drawingPointsRef.current.push(coords);
        updateCurrentDrawing({
          type: 'drawing',
          pageNumber,
          x: 0,
          y: 0,
          points: [...drawingPointsRef.current],
          color: '#ff0000',
        });
      } else if (tool === 'highlight' || tool === 'rectangle' || tool === 'circle') {
        const width = coords.x - drawStart.x;
        const height = coords.y - drawStart.y;
        updateCurrentDrawing({
          type: tool,
          pageNumber,
          x: width >= 0 ? drawStart.x : coords.x,
          y: height >= 0 ? drawStart.y : coords.y,
          width: Math.abs(width),
          height: Math.abs(height),
          color: tool === 'highlight' ? 'rgba(255, 255, 0, 0.4)' : '#ff0000',
        });
      } else if (tool === 'arrow') {
        updateCurrentDrawing({
          type: 'arrow',
          pageNumber,
          x: drawStart.x,
          y: drawStart.y,
          points: [drawStart, coords],
          color: '#ff0000',
        });
      }
    };

    const handleDocumentMouseUp = () => {
      handleMouseUp();
    };

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [isDrawing, drawStart, currentTool, pageNumber, getCoordinates, updateCurrentDrawing, handleMouseUp]);

  // Touch event handlers for mobile drawing
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (currentTool === 'select' || currentTool === 'pan') return;

      // Prevent default to stop scrolling when drawing
      e.preventDefault();

      const coords = getTouchCoordinates(e);
      setIsDrawing(true);
      setDrawStart(coords);

      // Initialize currentDrawing for all tools
      if (currentTool === 'draw') {
        drawingPointsRef.current = [coords];
        updateCurrentDrawing({
          type: 'drawing',
          pageNumber,
          x: 0,
          y: 0,
          points: [coords],
          color: '#ff0000',
        });
      } else if (currentTool === 'arrow') {
        updateCurrentDrawing({
          type: 'arrow',
          pageNumber,
          x: coords.x,
          y: coords.y,
          points: [coords, coords],
          color: '#ff0000',
        });
      } else if (currentTool === 'highlight' || currentTool === 'rectangle' || currentTool === 'circle') {
        updateCurrentDrawing({
          type: currentTool,
          pageNumber,
          x: coords.x,
          y: coords.y,
          width: 0,
          height: 0,
          color: currentTool === 'highlight' ? 'rgba(255, 255, 0, 0.4)' : '#ff0000',
        });
      }
    },
    [currentTool, getTouchCoordinates, pageNumber, updateCurrentDrawing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDrawing || !drawStart) return;
      if (currentTool === 'select' || currentTool === 'pan') return;

      // Prevent default to stop scrolling
      e.preventDefault();

      const coords = getTouchCoordinates(e);

      if (currentTool === 'draw') {
        drawingPointsRef.current.push(coords);
        updateCurrentDrawing({
          type: 'drawing',
          pageNumber,
          x: 0,
          y: 0,
          points: [...drawingPointsRef.current],
          color: '#ff0000',
        });
      } else if (currentTool === 'highlight' || currentTool === 'rectangle' || currentTool === 'circle') {
        const width = coords.x - drawStart.x;
        const height = coords.y - drawStart.y;
        updateCurrentDrawing({
          type: currentTool,
          pageNumber,
          x: width >= 0 ? drawStart.x : coords.x,
          y: height >= 0 ? drawStart.y : coords.y,
          width: Math.abs(width),
          height: Math.abs(height),
          color: currentTool === 'highlight' ? 'rgba(255, 255, 0, 0.4)' : '#ff0000',
        });
      } else if (currentTool === 'arrow') {
        updateCurrentDrawing({
          type: 'arrow',
          pageNumber,
          x: drawStart.x,
          y: drawStart.y,
          points: [drawStart, coords],
          color: '#ff0000',
        });
      }
    },
    [isDrawing, drawStart, currentTool, getTouchCoordinates, pageNumber, updateCurrentDrawing]
  );

  const handleTouchEnd = useCallback(() => {
    handleMouseUp(); // Reuse the same logic as mouse up
  }, [handleMouseUp]);

  // Helper to check if a point is near a drawing path
  const isPointNearDrawing = useCallback((point: { x: number; y: number }, annotation: Annotation, threshold: number = 10): boolean => {
    if (!annotation.points || annotation.points.length < 2) return false;

    for (let i = 0; i < annotation.points.length - 1; i++) {
      const p1 = annotation.points[i];
      const p2 = annotation.points[i + 1];

      // Calculate distance from point to line segment
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lengthSquared = dx * dx + dy * dy;

      if (lengthSquared === 0) {
        // p1 and p2 are the same point
        const dist = Math.sqrt((point.x - p1.x) ** 2 + (point.y - p1.y) ** 2);
        if (dist <= threshold) return true;
        continue;
      }

      const t = Math.max(0, Math.min(1, ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSquared));
      const projX = p1.x + t * dx;
      const projY = p1.y + t * dy;
      const dist = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);

      if (dist <= threshold) return true;
    }
    return false;
  }, []);

  // Helper to check if point is inside annotation bounds
  const isPointInAnnotation = useCallback((point: { x: number; y: number }, annotation: Annotation): boolean => {
    if (annotation.type === 'drawing' || annotation.type === 'arrow') {
      return isPointNearDrawing(point, annotation, 15);
    }

    // For other types, use bounding box
    const width = annotation.width || (annotation.type === 'text' ? 100 : 50);
    const height = annotation.height || (annotation.type === 'text' ? 30 : 20);

    return (
      point.x >= annotation.x &&
      point.x <= annotation.x + width &&
      point.y >= annotation.y &&
      point.y <= annotation.y + height
    );
  }, [isPointNearDrawing]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't handle click if we're dragging
      if (draggingAnnotation) return;

      if (currentTool === 'text') {
        // If text input is already open, don't create a new one - user must confirm or cancel first
        if (textInputPosition) return;

        const coords = getCoordinates(e);
        // Offset y position upward so text appears at click point, not below it
        const fontSize = 16;
        setTextInputPosition({ x: coords.x, y: coords.y - fontSize });
        setTextInputValue('');
        setTextInputSize({ width: 150, height: 40 });
        setTextInputFontSize(16);
        setTextInputFontFamily('Inter, sans-serif');
        setTextInputColor('#000000');
        setTextInputBgColor(undefined);
        setTextInputBgOpacity(100);
        setEditingAnnotationId(null);
        // Focus the input after it renders
        setTimeout(() => textInputRef.current?.focus(), 0);
      } else if (currentTool === 'eraser') {
        const screenCoords = getCoordinates(e);
        // Convert screen coordinates to page coordinates to match stored annotations
        const pageCoords = screenToPageCoords(screenCoords.x, screenCoords.y);
        // Find and delete annotation at this position
        const annotation = state.annotations.find(
          (a) => a.pageNumber === pageNumber && isPointInAnnotation(pageCoords, a)
        );
        if (annotation) {
          deleteAnnotation(annotation.id);
        }
      } else if (currentTool === 'select') {
        // Deselect when clicking on empty area (not on an annotation)
        // Check if click target is not an annotation element
        const target = e.target as HTMLElement;
        if (!target.closest('.annotation-element')) {
          setSelectedAnnotationId(null);
        }
      }
    },
    [currentTool, getCoordinates, pageNumber, deleteAnnotation, state.annotations, isPointInAnnotation, draggingAnnotation, screenToPageCoords, textInputPosition]
  );

  // Handle text input submission
  const handleTextSubmit = useCallback(() => {
    if (textInputValue.trim() && textInputPosition) {
      // The container is positioned with drag handle at top (16px)
      // The actual text position is 16px below the container position
      const dragHandleHeight = 16;
      const textScreenY = textInputPosition.y + dragHandleHeight;
      // Convert screen position to page coordinates
      const pageCoords = screenToPageCoords(textInputPosition.x, textScreenY);

      if (editingAnnotationId) {
        // Update existing annotation including position (in case it was moved)
        updateAnnotation(editingAnnotationId, {
          x: pageCoords.x,
          y: pageCoords.y,
          content: textInputValue.trim(),
          width: textInputSize.width,
          height: textInputSize.height,
          fontSize: textInputFontSize,
          fontFamily: textInputFontFamily,
          color: textInputColor,
          backgroundColor: textInputBgColor,
          backgroundOpacity: textInputBgOpacity,
        });
      } else {
        // Create new annotation
        addAnnotation({
          type: 'text',
          pageNumber,
          x: pageCoords.x,
          y: pageCoords.y,
          width: textInputSize.width,
          height: textInputSize.height,
          content: textInputValue.trim(),
          color: textInputColor,
          fontSize: textInputFontSize,
          fontFamily: textInputFontFamily,
          backgroundColor: textInputBgColor,
          backgroundOpacity: textInputBgOpacity,
        });
      }
    } else if (editingAnnotationId && !textInputValue.trim()) {
      // If editing and text is empty, delete the annotation
      deleteAnnotation(editingAnnotationId);
    }
    setTextInputPosition(null);
    setTextInputValue('');
    setEditingAnnotationId(null);
  }, [textInputValue, textInputPosition, textInputSize, textInputFontSize, textInputFontFamily, textInputColor, textInputBgColor, textInputBgOpacity, pageNumber, addAnnotation, updateAnnotation, deleteAnnotation, editingAnnotationId, screenToPageCoords]);

  // Handle text input key events
  const handleTextKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    } else if (e.key === 'Escape') {
      setTextInputPosition(null);
      setTextInputValue('');
      setEditingAnnotationId(null);
    }
  }, [handleTextSubmit]);

  // Handle double-click on text annotation to edit
  const handleTextDoubleClick = useCallback((e: React.MouseEvent, annotation: Annotation) => {
    e.stopPropagation();
    e.preventDefault();

    // Get screen position of the annotation
    const screenPos = pageToScreenCoords(annotation.x, annotation.y);

    // The text input container has a 16px drag handle at top, so offset position
    // upward so the text area aligns with where the annotation was displayed
    const dragHandleHeight = 16;
    setTextInputPosition({ x: screenPos.x, y: screenPos.y - dragHandleHeight });
    setTextInputValue(annotation.content || '');
    setTextInputSize({
      width: annotation.width || 150,
      height: annotation.height || 40,
    });
    setTextInputFontSize(annotation.fontSize || 16);
    setTextInputFontFamily(annotation.fontFamily || 'Inter, sans-serif');
    setTextInputColor(annotation.color || '#000000');
    setTextInputBgColor(annotation.backgroundColor);
    setTextInputBgOpacity(annotation.backgroundOpacity ?? 100);
    setEditingAnnotationId(annotation.id);
    setSelectedAnnotationId(null);

    // Focus the input after it renders
    setTimeout(() => textInputRef.current?.focus(), 0);
  }, [pageToScreenCoords]);

  // Handle font/style change while typing
  const handleTextInputFontChange = useCallback((property: 'fontSize' | 'fontFamily' | 'color' | 'backgroundColor' | 'backgroundOpacity', value: string | number | undefined) => {
    if (property === 'fontSize') {
      setTextInputFontSize(value as number);
    } else if (property === 'fontFamily') {
      setTextInputFontFamily(value as string);
    } else if (property === 'color') {
      setTextInputColor(value as string);
    } else if (property === 'backgroundColor') {
      setTextInputBgColor(value as string | undefined);
    } else if (property === 'backgroundOpacity') {
      setTextInputBgOpacity(value as number);
    }
  }, []);

  // Handle text input resize (mouse and touch)
  const handleTextInputResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    setTextInputResizing(handle);
  }, []);

  const handleTextInputResizeMove = useCallback((e: React.MouseEvent) => {
    if (!textInputResizing || !textInputPosition) return;

    const coords = getCoordinates(e);

    let newX = textInputPosition.x;
    let newY = textInputPosition.y;
    let newWidth = textInputSize.width;
    let newHeight = textInputSize.height;

    // Handle east (right) edge
    if (textInputResizing.includes('e')) {
      newWidth = Math.max(80, coords.x - textInputPosition.x);
    }
    // Handle west (left) edge
    if (textInputResizing.includes('w')) {
      const right = textInputPosition.x + textInputSize.width;
      newX = Math.min(coords.x, right - 80);
      newWidth = right - newX;
    }
    // Handle south (bottom) edge
    if (textInputResizing.includes('s')) {
      newHeight = Math.max(24, coords.y - textInputPosition.y);
    }
    // Handle north (top) edge
    if (textInputResizing.includes('n')) {
      const bottom = textInputPosition.y + textInputSize.height;
      newY = Math.min(coords.y, bottom - 24);
      newHeight = bottom - newY;
    }

    setTextInputPosition({ x: newX, y: newY });
    setTextInputSize({ width: newWidth, height: newHeight });
  }, [textInputResizing, textInputPosition, textInputSize, getCoordinates]);

  // Handle text input dragging (moving the box)
  const [textInputDragging, setTextInputDragging] = useState(false);
  const [textInputDragOffset, setTextInputDragOffset] = useState({ x: 0, y: 0 });

  const handleTextInputResizeEnd = useCallback(() => {
    setTextInputResizing(null);
    setTextInputDragging(false);
  }, []);

  // Use document-level event listeners for text input resize/drag to capture mouse/touch outside container
  useEffect(() => {
    if (!textInputResizing && !textInputDragging) return;

    const handleMove = (coords: { x: number; y: number }) => {
      if (textInputResizing && textInputPosition) {
        let newX = textInputPosition.x;
        let newY = textInputPosition.y;
        let newWidth = textInputSize.width;
        let newHeight = textInputSize.height;

        if (textInputResizing.includes('e')) {
          newWidth = Math.max(80, coords.x - textInputPosition.x);
        }
        if (textInputResizing.includes('w')) {
          const right = textInputPosition.x + textInputSize.width;
          newX = Math.min(coords.x, right - 80);
          newWidth = right - newX;
        }
        if (textInputResizing.includes('s')) {
          newHeight = Math.max(24, coords.y - textInputPosition.y);
        }
        if (textInputResizing.includes('n')) {
          const bottom = textInputPosition.y + textInputSize.height;
          newY = Math.min(coords.y, bottom - 24);
          newHeight = bottom - newY;
        }

        setTextInputPosition({ x: newX, y: newY });
        setTextInputSize({ width: newWidth, height: newHeight });
      }

      if (textInputDragging && textInputPosition) {
        setTextInputPosition({
          x: coords.x - textInputDragOffset.x,
          y: coords.y - textInputDragOffset.y,
        });
      }
    };

    const handleDocumentMouseMove = (e: MouseEvent) => {
      handleMove(getCoordinates(e));
    };

    const handleDocumentTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        e.preventDefault(); // Prevent scrolling while resizing
        handleMove(getTouchCoordinates(e));
      }
    };

    const handleDocumentEnd = () => {
      setTextInputResizing(null);
      setTextInputDragging(false);
    };

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentEnd);
    document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false });
    document.addEventListener('touchend', handleDocumentEnd);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentEnd);
      document.removeEventListener('touchmove', handleDocumentTouchMove);
      document.removeEventListener('touchend', handleDocumentEnd);
    };
  }, [textInputResizing, textInputDragging, textInputPosition, textInputSize, textInputDragOffset, getCoordinates, getTouchCoordinates]);

  const handleTextInputDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const coords = 'touches' in e ? getTouchCoordinates(e) : getCoordinates(e);
    if (textInputPosition) {
      setTextInputDragging(true);
      setTextInputDragOffset({
        x: coords.x - textInputPosition.x,
        y: coords.y - textInputPosition.y,
      });
    }
  }, [getCoordinates, getTouchCoordinates, textInputPosition]);

  const handleTextInputDragMove = useCallback((e: React.MouseEvent) => {
    if (!textInputDragging) return;

    const coords = getCoordinates(e);
    setTextInputPosition({
      x: coords.x - textInputDragOffset.x,
      y: coords.y - textInputDragOffset.y,
    });
  }, [textInputDragging, textInputDragOffset, getCoordinates]);

  // No click-outside handler - user must click the confirm button to close

  // Handle annotation drag start
  const handleAnnotationMouseDown = useCallback((e: React.MouseEvent, annotationId: string, annotation: Annotation) => {
    if (currentTool !== 'select') return;
    e.stopPropagation();
    e.preventDefault();

    // Select the annotation
    setSelectedAnnotationId(annotationId);

    const screenCoords = getCoordinates(e);
    // Calculate the page center
    const pageCenterX = annotation.x + (annotation.width || 0) / 2;
    const pageCenterY = annotation.y + (annotation.height || 0) / 2;
    // Transform to screen center
    const screenCenter = pageToScreenCoords(pageCenterX, pageCenterY);
    setDraggingAnnotation(annotationId);
    // Store offset from mouse to screen center
    setDragOffset({
      x: screenCoords.x - screenCenter.x,
      y: screenCoords.y - screenCenter.y,
    });
  }, [currentTool, getCoordinates, pageToScreenCoords]);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, annotationId: string, handle: string, annotation: Annotation) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing({ annotationId, handle });
    setResizeStart({
      x: annotation.x,
      y: annotation.y,
      width: annotation.width || 100,
      height: annotation.height || 30,
    });
  }, []);

  // Handle resize drag
  const handleResizeDrag = useCallback((e: React.MouseEvent) => {
    if (!resizing || !resizeStart) return;

    const coords = getCoordinates(e);
    const pageCoords = screenToPageCoords(coords.x, coords.y);
    const annotation = state.annotations.find(a => a.id === resizing.annotationId);
    if (!annotation) return;

    let newX = resizeStart.x;
    let newY = resizeStart.y;
    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;

    // Handle different resize handles
    if (resizing.handle.includes('e')) {
      newWidth = Math.max(50, pageCoords.x - annotation.x);
    }
    if (resizing.handle.includes('w')) {
      const newRight = annotation.x + (annotation.width || 100);
      newX = Math.min(pageCoords.x, newRight - 50);
      newWidth = newRight - newX;
    }
    if (resizing.handle.includes('s')) {
      newHeight = Math.max(20, pageCoords.y - annotation.y);
    }
    if (resizing.handle.includes('n')) {
      const newBottom = annotation.y + (annotation.height || 30);
      newY = Math.min(pageCoords.y, newBottom - 20);
      newHeight = newBottom - newY;
    }

    updateAnnotation(resizing.annotationId, {
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
    });
  }, [resizing, resizeStart, getCoordinates, screenToPageCoords, state.annotations, updateAnnotation]);

  // Handle resize end
  const handleResizeEnd = useCallback(() => {
    setResizing(null);
    setResizeStart(null);
  }, []);

  // Handle font change for selected text annotation
  const handleFontChange = useCallback((property: 'fontSize' | 'fontFamily' | 'color' | 'backgroundColor' | 'backgroundOpacity', value: string | number | undefined) => {
    if (!selectedAnnotationId) return;
    updateAnnotation(selectedAnnotationId, { [property]: value });
  }, [selectedAnnotationId, updateAnnotation]);

  // Handle annotation drag
  const handleAnnotationDrag = useCallback((e: React.MouseEvent) => {
    if (!draggingAnnotation) return;

    const screenCoords = getCoordinates(e);
    const annotation = state.annotations.find(a => a.id === draggingAnnotation);
    if (!annotation) return;

    // Calculate new screen center
    const newScreenCenterX = screenCoords.x - dragOffset.x;
    const newScreenCenterY = screenCoords.y - dragOffset.y;
    // Convert screen center to page center
    const newPageCenter = screenToPageCoords(newScreenCenterX, newScreenCenterY);

    // Calculate page dimensions (stored in page space, so may be swapped from screen)
    const pageWidth = annotation.width || 0;
    const pageHeight = annotation.height || 0;

    // Store as top-left = center - dims/2
    updateAnnotation(draggingAnnotation, {
      x: newPageCenter.x - pageWidth / 2,
      y: newPageCenter.y - pageHeight / 2,
    });
  }, [draggingAnnotation, dragOffset, getCoordinates, state.annotations, updateAnnotation, screenToPageCoords]);

  // Handle annotation drag end
  const handleAnnotationMouseUp = useCallback(() => {
    setDraggingAnnotation(null);
    handleResizeEnd();
  }, [handleResizeEnd]);

  // Combined mouse move handler for drag and resize
  const handleContainerMouseMove = useCallback((e: React.MouseEvent) => {
    if (resizing) {
      handleResizeDrag(e);
    } else {
      handleAnnotationDrag(e);
    }
  }, [resizing, handleResizeDrag, handleAnnotationDrag]);

  // Filter annotations for this page, excluding the one being edited (to avoid showing duplicate)
  const pageAnnotations = state.annotations.filter(
    (a) => a.pageNumber === pageNumber && a.id !== editingAnnotationId
  );

  // Get selected annotation for font toolbar
  const selectedAnnotation = selectedAnnotationId
    ? state.annotations.find(a => a.id === selectedAnnotationId)
    : null;

  // Check if we should show text layer (for text selection)
  const showTextLayer = currentTool === 'select' || currentTool === 'pan';

  return (
    <div
      className={`page-canvas-container ${draggingAnnotation ? 'dragging-annotation' : ''} ${resizing ? 'resizing-annotation' : ''}`}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        // Disable touch scrolling when a drawing tool is active
        touchAction: isDrawingTool ? 'none' : 'auto',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleContainerMouseMove}
      onMouseUp={handleAnnotationMouseUp}
      onMouseLeave={handleAnnotationMouseUp}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas
        ref={canvasRef}
        className={`page-canvas tool-${currentTool}`}
      />
      {/* Text layer for text selection */}
      <div
        ref={textLayerRef}
        className={`textLayer ${showTextLayer ? 'active' : ''}`}
      />
      {isRendering && (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      )}
      <div
        ref={annotationLayerRef}
        className="annotation-layer"
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        {pageAnnotations.map((annotation) => (
          <AnnotationRenderer
            key={annotation.id}
            annotation={annotation}
            scale={scale}
            onMouseDown={(e) => handleAnnotationMouseDown(e, annotation.id, annotation)}
            onDoubleClick={annotation.type === 'text' ? (e) => handleTextDoubleClick(e, annotation) : undefined}
            isDraggable={currentTool === 'select'}
            isSelected={selectedAnnotationId === annotation.id}
            onResizeStart={(e, handle) => handleResizeStart(e, annotation.id, handle, annotation)}
            pageToScreenCoords={pageToScreenCoords}
            totalRotation={totalRotation}
          />
        ))}
        {currentDrawing && (
          <AnnotationRenderer
            annotation={{ ...currentDrawing, id: 'temp' } as Annotation}
            scale={scale}
            isCurrentDrawing={true}
          />
        )}
      </div>
      {/* Inline text input with resize handles */}
      {textInputPosition && (
        <>
          <div
            ref={textInputContainerRef}
            className={`text-input-container ${textInputDragging ? 'dragging' : ''} ${textInputResizing ? 'resizing' : ''}`}
            style={{
              position: 'absolute',
              left: textInputPosition.x * scale,
              top: textInputPosition.y * scale,
              width: textInputSize.width * scale,
              height: (textInputSize.height + 16) * scale,
            }}
            onMouseMove={(e) => {
              handleTextInputResizeMove(e);
              handleTextInputDragMove(e);
            }}
            onMouseUp={handleTextInputResizeEnd}
          >
            {/* Drag handle header */}
            <div
              className="text-input-drag-handle"
              onMouseDown={handleTextInputDragStart}
              onTouchStart={handleTextInputDragStart}
            />
            <textarea
              ref={textInputRef}
              className="inline-text-input"
              style={{
                width: '100%',
                height: `calc(100% - 16px)`,
                fontSize: textInputFontSize * scale,
                fontFamily: textInputFontFamily,
                color: textInputColor,
                backgroundColor: textInputBgColor
                  ? `rgba(${parseInt(textInputBgColor.slice(1, 3), 16)}, ${parseInt(textInputBgColor.slice(3, 5), 16)}, ${parseInt(textInputBgColor.slice(5, 7), 16)}, ${textInputBgOpacity / 100})`
                  : 'transparent',
              }}
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              onKeyDown={handleTextKeyDown}
              placeholder="Type here..."
            />
            {/* All 8 resize handles */}
            {['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].map((handle) => (
              <div
                key={handle}
                className={`text-input-resize-handle ${handle}`}
                onMouseDown={(e) => handleTextInputResizeStart(e, handle)}
                onTouchStart={(e) => handleTextInputResizeStart(e, handle)}
              />
            ))}
            {/* Confirm button */}
            <button
              className="text-input-confirm"
              onClick={(e) => {
                e.stopPropagation();
                handleTextSubmit();
              }}
              title="Confirm (Enter)"
            >
              ✓
            </button>
          </div>
          {/* Font toolbar for text input */}
          <div
            className="text-format-toolbar"
            style={{
              position: 'absolute',
              left: textInputPosition.x * scale,
              top: (textInputPosition.y - 45) * scale,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <select
              value={textInputFontFamily}
              onChange={(e) => handleTextInputFontChange('fontFamily', e.target.value)}
              className="font-select"
            >
              <option value="Inter, sans-serif">Inter</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="Times New Roman, serif">Times</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="Courier New, monospace">Courier</option>
              <option value="Comic Sans MS, cursive">Comic Sans</option>
            </select>
            <select
              value={textInputFontSize}
              onChange={(e) => handleTextInputFontChange('fontSize', parseInt(e.target.value, 10))}
              className="size-select"
            >
              {[12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map((size) => (
                <option key={size} value={size}>{size}px</option>
              ))}
            </select>
            <input
              type="color"
              value={textInputColor}
              onChange={(e) => handleTextInputFontChange('color', e.target.value)}
              className="color-input"
              title="Text color"
            />
            <span className="toolbar-divider" />
            <label className="bg-toggle" title="Background color">
              <input
                type="checkbox"
                checked={textInputBgColor !== undefined}
                onChange={(e) => handleTextInputFontChange('backgroundColor', e.target.checked ? '#ffff00' : undefined)}
              />
              <span className="bg-icon">BG</span>
            </label>
            {textInputBgColor !== undefined && (
              <>
                <input
                  type="color"
                  value={textInputBgColor}
                  onChange={(e) => handleTextInputFontChange('backgroundColor', e.target.value)}
                  className="color-input"
                  title="Background color"
                />
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={textInputBgOpacity}
                  onChange={(e) => handleTextInputFontChange('backgroundOpacity', parseInt(e.target.value, 10))}
                  className="opacity-slider"
                  title={`Opacity: ${textInputBgOpacity}%`}
                />
              </>
            )}
          </div>
        </>
      )}
      {/* Font toolbar for selected text annotation */}
      {selectedAnnotation && selectedAnnotation.type === 'text' && !textInputPosition && (
        <TextFormatToolbar
          annotation={selectedAnnotation}
          scale={scale}
          pageToScreenCoords={pageToScreenCoords}
          onFontChange={handleFontChange}
        />
      )}
    </div>
  );
}

interface AnnotationRendererProps {
  annotation: Annotation;
  scale: number;
  onMouseDown?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  isDraggable?: boolean;
  isSelected?: boolean;
  onResizeStart?: (e: React.MouseEvent, handle: string) => void;
  pageToScreenCoords?: (pageX: number, pageY: number) => { x: number; y: number };
  totalRotation?: number;
  isCurrentDrawing?: boolean; // For live drawing preview, don't transform
}

// Resize handles component
function ResizeHandles({
  onResizeStart,
}: {
  scale: number;
  onResizeStart: (e: React.MouseEvent, handle: string) => void;
}) {
  const handles = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
  const handleSize = 8;

  return (
    <>
      {handles.map((handle) => {
        const style: React.CSSProperties = {
          position: 'absolute',
          width: handleSize,
          height: handleSize,
          background: 'var(--accent-color, #02B7FF)',
          border: '1px solid white',
          borderRadius: 2,
          cursor: `${handle}-resize`,
        };

        // Position handles
        if (handle.includes('n')) style.top = -handleSize / 2;
        if (handle.includes('s')) style.bottom = -handleSize / 2;
        if (handle.includes('w')) style.left = -handleSize / 2;
        if (handle.includes('e')) style.right = -handleSize / 2;
        if (handle === 'n' || handle === 's') {
          style.left = '50%';
          style.transform = 'translateX(-50%)';
        }
        if (handle === 'w' || handle === 'e') {
          style.top = '50%';
          style.transform = 'translateY(-50%)';
        }

        return (
          <div
            key={handle}
            style={style}
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart(e, handle);
            }}
          />
        );
      })}
    </>
  );
}

// Text format toolbar component
interface TextFormatToolbarProps {
  annotation: Annotation;
  scale: number;
  pageToScreenCoords?: (pageX: number, pageY: number) => { x: number; y: number };
  onFontChange: (property: 'fontSize' | 'fontFamily' | 'color' | 'backgroundColor' | 'backgroundOpacity', value: string | number | undefined) => void;
}

function TextFormatToolbar({ annotation, scale, pageToScreenCoords, onFontChange }: TextFormatToolbarProps) {
  const screenPos = pageToScreenCoords
    ? pageToScreenCoords(annotation.x, annotation.y)
    : { x: annotation.x, y: annotation.y };

  const fonts = [
    { value: 'Inter, sans-serif', label: 'Inter' },
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'Times New Roman, serif', label: 'Times' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: 'Courier New, monospace', label: 'Courier' },
    { value: 'Comic Sans MS, cursive', label: 'Comic Sans' },
  ];

  const sizes = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

  return (
    <div
      className="text-format-toolbar"
      style={{
        position: 'absolute',
        left: screenPos.x * scale,
        top: (screenPos.y - 40) * scale,
        transform: 'translateY(-100%)',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <select
        value={annotation.fontFamily || 'Inter, sans-serif'}
        onChange={(e) => onFontChange('fontFamily', e.target.value)}
        className="font-select"
      >
        {fonts.map((font) => (
          <option key={font.value} value={font.value}>
            {font.label}
          </option>
        ))}
      </select>
      <select
        value={annotation.fontSize || 16}
        onChange={(e) => onFontChange('fontSize', parseInt(e.target.value, 10))}
        className="size-select"
      >
        {sizes.map((size) => (
          <option key={size} value={size}>
            {size}px
          </option>
        ))}
      </select>
      <input
        type="color"
        value={annotation.color || '#000000'}
        onChange={(e) => onFontChange('color', e.target.value)}
        className="color-input"
        title="Text color"
      />
      <span className="toolbar-divider" />
      <label className="bg-toggle" title="Background color">
        <input
          type="checkbox"
          checked={annotation.backgroundColor !== undefined}
          onChange={(e) => onFontChange('backgroundColor', e.target.checked ? '#ffff00' : undefined)}
        />
        <span className="bg-icon">BG</span>
      </label>
      {annotation.backgroundColor !== undefined && (
        <>
          <input
            type="color"
            value={annotation.backgroundColor}
            onChange={(e) => onFontChange('backgroundColor', e.target.value)}
            className="color-input"
            title="Background color"
          />
          <input
            type="range"
            min="10"
            max="100"
            value={annotation.backgroundOpacity ?? 100}
            onChange={(e) => onFontChange('backgroundOpacity', parseInt(e.target.value, 10))}
            className="opacity-slider"
            title={`Opacity: ${annotation.backgroundOpacity ?? 100}%`}
          />
        </>
      )}
    </div>
  );
}

function AnnotationRenderer({
  annotation,
  scale,
  onMouseDown,
  onDoubleClick,
  isDraggable,
  isSelected,
  onResizeStart,
  pageToScreenCoords,
  totalRotation = 0,
  isCurrentDrawing,
}: AnnotationRendererProps) {
  // For current drawing preview, use coordinates as-is (they're already in screen space)
  // For stored annotations, transform from page space to screen space
  const getScreenPosition = (x: number, y: number) => {
    if (isCurrentDrawing || !pageToScreenCoords) {
      return { x, y };
    }
    return pageToScreenCoords(x, y);
  };

  // Transform a bounding box from page to screen coordinates using center-based approach
  // This ensures the annotation stays at the same physical location regardless of rotation
  const getScreenBoundingBox = (x: number, y: number, width: number, height: number) => {
    if (isCurrentDrawing || !pageToScreenCoords) {
      return { x, y, width, height };
    }

    // Calculate center in page coordinates
    const pageCenterX = x + width / 2;
    const pageCenterY = y + height / 2;

    // Transform center to screen coordinates
    const screenCenter = pageToScreenCoords(pageCenterX, pageCenterY);

    // Swap dimensions for 90/270 rotations
    const screenDims = (totalRotation === 90 || totalRotation === 270)
      ? { width: height, height: width }
      : { width, height };

    // Calculate screen top-left from screen center
    return {
      x: screenCenter.x - screenDims.width / 2,
      y: screenCenter.y - screenDims.height / 2,
      width: screenDims.width,
      height: screenDims.height,
    };
  };

  const screenPos = getScreenPosition(annotation.x, annotation.y);
  const style: React.CSSProperties = {
    position: 'absolute',
    left: screenPos.x * scale,
    top: screenPos.y * scale,
    pointerEvents: isDraggable ? 'auto' : 'none',
    cursor: isDraggable ? 'move' : 'default',
  };

  switch (annotation.type) {
    case 'highlight': {
      const box = getScreenBoundingBox(annotation.x, annotation.y, annotation.width || 0, annotation.height || 0);
      return (
        <div
          style={{
            position: 'absolute',
            left: box.x * scale,
            top: box.y * scale,
            width: box.width * scale,
            height: box.height * scale,
            backgroundColor: annotation.color || 'rgba(255, 255, 0, 0.4)',
            pointerEvents: isDraggable ? 'auto' : 'none',
            cursor: isDraggable ? 'move' : 'default',
          }}
          onMouseDown={onMouseDown}
        />
      );
    }
    case 'text': {
      const textWidth = annotation.width || 'auto';
      // Calculate background color with opacity
      let bgColor: string | undefined;
      if (annotation.backgroundColor) {
        const opacity = (annotation.backgroundOpacity ?? 100) / 100;
        // Convert hex to rgba
        const hex = annotation.backgroundColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        bgColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }
      return (
        <div
          className={`annotation-element ${isSelected ? 'selected' : ''}`}
          style={{
            ...style,
            color: annotation.color || '#000',
            fontSize: (annotation.fontSize || 16) * scale,
            fontFamily: annotation.fontFamily || 'Inter, sans-serif',
            whiteSpace: 'pre-wrap',
            pointerEvents: isDraggable ? 'auto' : 'none',
            cursor: isDraggable ? 'move' : 'default',
            userSelect: 'none',
            width: textWidth !== 'auto' ? textWidth * scale : undefined,
            minWidth: 50 * scale,
            outline: isSelected ? '2px solid var(--accent-color, #02B7FF)' : 'none',
            outlineOffset: 2,
            position: 'absolute',
            backgroundColor: bgColor,
            padding: bgColor ? '2px 4px' : undefined,
            borderRadius: bgColor ? '2px' : undefined,
          }}
          onMouseDown={onMouseDown}
          onDoubleClick={onDoubleClick}
        >
          {annotation.content}
          {isSelected && onResizeStart && (
            <ResizeHandles scale={scale} onResizeStart={onResizeStart} />
          )}
        </div>
      );
    }
    case 'rectangle': {
      const box = getScreenBoundingBox(annotation.x, annotation.y, annotation.width || 0, annotation.height || 0);
      return (
        <div
          style={{
            position: 'absolute',
            left: box.x * scale,
            top: box.y * scale,
            width: box.width * scale,
            height: box.height * scale,
            border: `2px solid ${annotation.color || '#ff0000'}`,
            boxSizing: 'border-box',
            pointerEvents: isDraggable ? 'auto' : 'none',
            cursor: isDraggable ? 'move' : 'default',
          }}
          onMouseDown={onMouseDown}
        />
      );
    }
    case 'circle': {
      const box = getScreenBoundingBox(annotation.x, annotation.y, annotation.width || 0, annotation.height || 0);
      return (
        <div
          style={{
            position: 'absolute',
            left: box.x * scale,
            top: box.y * scale,
            width: box.width * scale,
            height: box.height * scale,
            border: `2px solid ${annotation.color || '#ff0000'}`,
            borderRadius: '50%',
            boxSizing: 'border-box',
            pointerEvents: isDraggable ? 'auto' : 'none',
            cursor: isDraggable ? 'move' : 'default',
          }}
          onMouseDown={onMouseDown}
        />
      );
    }
    case 'drawing': {
      if (!annotation.points || annotation.points.length < 2) return null;
      // Transform all points to screen coordinates
      const screenPoints = annotation.points.map(p => getScreenPosition(p.x, p.y));
      // Calculate bounding box for the drawing
      const xs = screenPoints.map(p => p.x);
      const ys = screenPoints.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      const padding = 10;

      const pathData = screenPoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x - minX + padding) * scale} ${(p.y - minY + padding) * scale}`)
        .join(' ');
      return (
        <svg
          style={{
            position: 'absolute',
            left: (minX - padding) * scale,
            top: (minY - padding) * scale,
            width: (maxX - minX + padding * 2) * scale,
            height: (maxY - minY + padding * 2) * scale,
            pointerEvents: isDraggable ? 'auto' : 'none',
            cursor: isDraggable ? 'move' : 'default',
          }}
          onMouseDown={onMouseDown}
        >
          <path
            d={pathData}
            stroke={annotation.color || '#ff0000'}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="stroke"
          />
        </svg>
      );
    }
    case 'arrow': {
      if (!annotation.points || annotation.points.length < 2) return null;
      // Transform points to screen coordinates
      const screenPoints = annotation.points.map(p => getScreenPosition(p.x, p.y));
      const [start, end] = screenPoints;
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const arrowLength = 10;
      // Calculate bounding box
      const minX = Math.min(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxX = Math.max(start.x, end.x);
      const maxY = Math.max(start.y, end.y);
      const padding = 15;

      return (
        <svg
          style={{
            position: 'absolute',
            left: (minX - padding) * scale,
            top: (minY - padding) * scale,
            width: (maxX - minX + padding * 2) * scale,
            height: (maxY - minY + padding * 2) * scale,
            pointerEvents: isDraggable ? 'auto' : 'none',
            cursor: isDraggable ? 'move' : 'default',
          }}
          onMouseDown={onMouseDown}
        >
          <line
            x1={(start.x - minX + padding) * scale}
            y1={(start.y - minY + padding) * scale}
            x2={(end.x - minX + padding) * scale}
            y2={(end.y - minY + padding) * scale}
            stroke={annotation.color || '#ff0000'}
            strokeWidth={2}
            pointerEvents="stroke"
          />
          <polygon
            points={`
              ${(end.x - minX + padding) * scale},${(end.y - minY + padding) * scale}
              ${(end.x - minX + padding) * scale - arrowLength * Math.cos(angle - Math.PI / 6)},${(end.y - minY + padding) * scale - arrowLength * Math.sin(angle - Math.PI / 6)}
              ${(end.x - minX + padding) * scale - arrowLength * Math.cos(angle + Math.PI / 6)},${(end.y - minY + padding) * scale - arrowLength * Math.sin(angle + Math.PI / 6)}
            `}
            fill={annotation.color || '#ff0000'}
          />
        </svg>
      );
    }
    case 'signature': {
      if (!annotation.content) return null;
      const box = getScreenBoundingBox(annotation.x, annotation.y, annotation.width || 150, annotation.height || 75);
      return (
        <img
          src={annotation.content}
          alt="Signature"
          style={{
            position: 'absolute',
            left: box.x * scale,
            top: box.y * scale,
            width: box.width * scale,
            height: box.height * scale,
            objectFit: 'contain',
            pointerEvents: isDraggable ? 'auto' : 'none',
            cursor: isDraggable ? 'move' : 'default',
          }}
          onMouseDown={onMouseDown}
          draggable={false}
        />
      );
    }
    default:
      return null;
  }
}

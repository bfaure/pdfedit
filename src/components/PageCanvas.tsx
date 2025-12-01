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
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // Annotation dragging state
  const [draggingAnnotation, setDraggingAnnotation] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
    [currentTool, getCoordinates, pageNumber, updateCurrentDrawing]
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
        const coords = getCoordinates(e);
        setTextInputPosition(coords);
        setTextInputValue('');
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
      }
    },
    [currentTool, getCoordinates, pageNumber, deleteAnnotation, state.annotations, isPointInAnnotation, draggingAnnotation, screenToPageCoords]
  );

  // Handle text input submission
  const handleTextSubmit = useCallback(() => {
    if (textInputValue.trim() && textInputPosition) {
      // Convert screen coordinates to page coordinates for storage
      const pageCoords = screenToPageCoords(textInputPosition.x, textInputPosition.y);
      addAnnotation({
        type: 'text',
        pageNumber,
        x: pageCoords.x,
        y: pageCoords.y,
        content: textInputValue.trim(),
        color: '#000000',
        fontSize: 16,
      });
    }
    setTextInputPosition(null);
    setTextInputValue('');
  }, [textInputValue, textInputPosition, pageNumber, addAnnotation, screenToPageCoords]);

  // Handle text input key events
  const handleTextKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    } else if (e.key === 'Escape') {
      setTextInputPosition(null);
      setTextInputValue('');
    }
  }, [handleTextSubmit]);

  // Handle annotation drag start
  const handleAnnotationMouseDown = useCallback((e: React.MouseEvent, annotationId: string, annotation: Annotation) => {
    if (currentTool !== 'select') return;
    e.stopPropagation();
    e.preventDefault();

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
  }, []);

  // Filter annotations for this page
  const pageAnnotations = state.annotations.filter((a) => a.pageNumber === pageNumber);

  // Check if we should show text layer (for text selection)
  const showTextLayer = currentTool === 'select' || currentTool === 'pan';

  return (
    <div
      className={`page-canvas-container ${draggingAnnotation ? 'dragging-annotation' : ''}`}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        // Disable touch scrolling when a drawing tool is active
        touchAction: isDrawingTool ? 'none' : 'auto',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleAnnotationDrag}
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
            isDraggable={currentTool === 'select'}
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
      {/* Inline text input */}
      {textInputPosition && (
        <textarea
          ref={textInputRef}
          className="inline-text-input"
          style={{
            left: textInputPosition.x * scale,
            top: textInputPosition.y * scale,
            fontSize: 16 * scale,
          }}
          value={textInputValue}
          onChange={(e) => setTextInputValue(e.target.value)}
          onKeyDown={handleTextKeyDown}
          onBlur={handleTextSubmit}
          placeholder="Type here..."
        />
      )}
    </div>
  );
}

interface AnnotationRendererProps {
  annotation: Annotation;
  scale: number;
  onMouseDown?: (e: React.MouseEvent) => void;
  isDraggable?: boolean;
  pageToScreenCoords?: (pageX: number, pageY: number) => { x: number; y: number };
  totalRotation?: number;
  isCurrentDrawing?: boolean; // For live drawing preview, don't transform
}

function AnnotationRenderer({
  annotation,
  scale,
  onMouseDown,
  isDraggable,
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
    case 'text':
      return (
        <div
          style={{
            ...style,
            color: annotation.color || '#000',
            fontSize: (annotation.fontSize || 16) * scale,
            whiteSpace: 'pre-wrap',
            pointerEvents: isDraggable ? 'auto' : 'none',
            cursor: isDraggable ? 'move' : 'default',
            userSelect: 'none',
          }}
          onMouseDown={onMouseDown}
        >
          {annotation.content}
        </div>
      );
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

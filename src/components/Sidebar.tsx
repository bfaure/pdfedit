import React, { useEffect, useState, useCallback, useRef } from 'react';
import { usePDF } from '../contexts/PDFContext';
import { getPageThumbnail } from '../utils/pdfUtils';
import './Sidebar.css';

interface ThumbnailCache {
  [key: string]: string; // key is `${pageNumber}-${rotation}`
}

interface SidebarProps {
  isOpen?: boolean;
  onExtractPages?: (pageNumbers: number[]) => void;
}

const MIN_SIDEBAR_WIDTH = 120;
const MAX_SIDEBAR_WIDTH = 400;
const DEFAULT_SIDEBAR_WIDTH = 200;

// Calculate thumbnail size based on sidebar width
const getThumbnailSize = (sidebarWidth: number) => {
  // Account for padding (12px on each side) and some margin
  const availableWidth = sidebarWidth - 40;
  // Scale from 100 at min width to 350 at max width
  return Math.max(100, Math.min(350, availableWidth));
};

export function Sidebar({ isOpen = true, onExtractPages }: SidebarProps) {
  const { state, pdfDocument, setCurrentPage, rotatePage, deletePage, restorePage, reorderPages } = usePDF();
  const [thumbnails, setThumbnails] = useState<ThumbnailCache>({});
  const [loadingPages, setLoadingPages] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pageNumber: number } | null>(null);

  // Multi-select state
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [lastClickedPage, setLastClickedPage] = useState<number | null>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  // Resize state
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Track thumbnail size for regeneration - debounced to avoid excessive regeneration
  const [debouncedWidth, setDebouncedWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedWidth(sidebarWidth);
    }, 300);
    return () => clearTimeout(timer);
  }, [sidebarWidth]);
  const thumbnailSize = getThumbnailSize(debouncedWidth);

  // Create a unique identifier for the current file (using name + size + lastModified)
  const fileId = state.file
    ? `${state.fileName}-${state.file.size}-${state.file.lastModified}`
    : '';

  // Load thumbnails - regenerate when global rotation or thumbnail size changes
  useEffect(() => {
    if (!pdfDocument) {
      setThumbnails({});
      return;
    }

    const loadThumbnails = async () => {
      for (let i = 1; i <= pdfDocument.numPages; i++) {
        const pageRotation = state.pageRotations.get(i) || 0;
        const totalRotation = (state.rotation + pageRotation) % 360;
        // Include file ID and thumbnail size in cache key so thumbnails regenerate for new files
        const cacheKey = `${fileId}-${i}-${totalRotation}-${thumbnailSize}`;

        if (thumbnails[cacheKey]) continue;

        setLoadingPages((prev) => new Set(prev).add(cacheKey));
        try {
          const page = await pdfDocument.getPage(i);
          const thumbnail = await getPageThumbnail(page, thumbnailSize, totalRotation);
          setThumbnails((prev) => ({ ...prev, [cacheKey]: thumbnail }));
        } catch (error) {
          console.error(`Error loading thumbnail for page ${i}:`, error);
        } finally {
          setLoadingPages((prev) => {
            const next = new Set(prev);
            next.delete(cacheKey);
            return next;
          });
        }
      }
    };

    loadThumbnails();
  }, [pdfDocument, fileId, state.rotation, state.pageRotations, thumbnailSize]);

  const handleContextMenu = useCallback((e: React.MouseEvent, pageNumber: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, pageNumber });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  useEffect(() => {
    if (contextMenu) {
      document.addEventListener('click', closeContextMenu);
      return () => document.removeEventListener('click', closeContextMenu);
    }
  }, [contextMenu, closeContextMenu]);

  // Auto-scroll to keep current page thumbnail visible
  useEffect(() => {
    if (!sidebarRef.current) return;

    const activeThumb = sidebarRef.current.querySelector('.thumbnail-item.active');
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [state.currentPage]);

  // Handle page click with CTRL/SHIFT selection
  const handlePageClick = useCallback((e: React.MouseEvent, pageNumber: number, index: number) => {
    const isDeleted = state.deletedPages.has(pageNumber);
    if (isDeleted) return;

    const pageOrder = state.pageOrder.length > 0
      ? state.pageOrder
      : Array.from({ length: state.numPages }, (_, i) => i + 1);

    if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      setSelectedPages(prev => {
        const next = new Set(prev);
        if (next.has(pageNumber)) {
          next.delete(pageNumber);
        } else {
          next.add(pageNumber);
        }
        return next;
      });
      setLastClickedPage(pageNumber);
    } else if (e.shiftKey && lastClickedPage !== null) {
      // Range selection
      const lastIndex = pageOrder.indexOf(lastClickedPage);
      const currentIndex = index;
      const start = Math.min(lastIndex, currentIndex);
      const end = Math.max(lastIndex, currentIndex);

      const newSelection = new Set<number>();
      for (let i = start; i <= end; i++) {
        const pg = pageOrder[i];
        if (!state.deletedPages.has(pg)) {
          newSelection.add(pg);
        }
      }
      setSelectedPages(newSelection);
    } else {
      // Regular click - clear selection and navigate
      setSelectedPages(new Set());
      setCurrentPage(pageNumber);
      setLastClickedPage(pageNumber);
    }
  }, [state.deletedPages, state.pageOrder, state.numPages, lastClickedPage, setCurrentPage]);

  // Handle extract selected pages
  const handleExtractSelected = useCallback(() => {
    if (selectedPages.size > 0 && onExtractPages) {
      const sortedPages = Array.from(selectedPages).sort((a, b) => a - b);
      onExtractPages(sortedPages);
    }
    closeContextMenu();
  }, [selectedPages, onExtractPages, closeContextMenu]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.stopPropagation();
    setDraggedIndex(index);
    dragNodeRef.current = e.currentTarget;

    // Set drag data with custom type to identify internal drags
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-pdf-page-reorder', String(index));

    // Add dragging class after a tick to allow the drag image to be captured
    setTimeout(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.classList.add('dragging');
      }
    }, 0);
  }, []);

  const handleDragEnd = useCallback((e?: React.DragEvent<HTMLDivElement>) => {
    e?.stopPropagation();
    if (dragNodeRef.current) {
      dragNodeRef.current.classList.remove('dragging');
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  }, [draggedIndex]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, toIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedIndex === null || draggedIndex === toIndex) {
      handleDragEnd();
      return;
    }

    reorderPages(draggedIndex, toIndex);
    handleDragEnd();
  }, [draggedIndex, reorderPages, handleDragEnd]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!sidebarRef.current) return;
      const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Keyboard handler for Delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if sidebar is focused (check if active element is within sidebar)
      if (!sidebarRef.current?.contains(document.activeElement) &&
          !sidebarRef.current?.matches(':focus-within')) {
        // Also check if we have selected pages and sidebar was recently interacted with
        if (selectedPages.size === 0) return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete selected pages or current page
        const pagesToDelete = selectedPages.size > 0
          ? Array.from(selectedPages)
          : [state.currentPage];

        // Don't delete if all remaining pages would be deleted
        const remainingAfterDelete = state.numPages - state.deletedPages.size - pagesToDelete.filter(p => !state.deletedPages.has(p)).length;
        if (remainingAfterDelete < 1) return;

        pagesToDelete.forEach(pageNum => {
          if (!state.deletedPages.has(pageNum)) {
            deletePage(pageNum);
          }
        });
        setSelectedPages(new Set());
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPages, state.currentPage, state.deletedPages, state.numPages, deletePage]);

  if (!pdfDocument) return null;

  // Use pageOrder for display order
  const pageOrder = state.pageOrder.length > 0 ? state.pageOrder : Array.from({ length: state.numPages }, (_, i) => i + 1);

  return (
    <div
      ref={sidebarRef}
      className={`sidebar ${isOpen ? 'open' : ''} ${isResizing ? 'resizing' : ''}`}
      style={{ width: sidebarWidth, minWidth: sidebarWidth }}
      tabIndex={-1}
    >
      <div className="sidebar-header">
        <span>Pages</span>
        <span className="page-count">{state.numPages}</span>
      </div>
      <div className="thumbnail-list">
        {pageOrder.map((pageNumber, index) => {
          const isDeleted = state.deletedPages.has(pageNumber);
          const pageRotation = state.pageRotations.get(pageNumber) || 0;
          const totalRotation = (state.rotation + pageRotation) % 360;
          const cacheKey = `${fileId}-${pageNumber}-${totalRotation}-${thumbnailSize}`;
          const isDragOver = dragOverIndex === index && draggedIndex !== index;
          const isSelected = selectedPages.has(pageNumber);

          // Determine if page is in landscape orientation (90 or 270 degrees)
          const isLandscape = totalRotation === 90 || totalRotation === 270;

          return (
            <div
              key={pageNumber}
              className={`thumbnail-item ${state.currentPage === pageNumber ? 'active' : ''} ${
                isDeleted ? 'deleted' : ''
              } ${isDragOver ? 'drag-over' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={(e) => handlePageClick(e, pageNumber, index)}
              onContextMenu={(e) => handleContextMenu(e, pageNumber)}
              draggable={!isDeleted}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
            >
              <div className={`thumbnail-wrapper ${isLandscape ? 'landscape' : ''}`}>
                {loadingPages.has(cacheKey) ? (
                  <div className="thumbnail-loading">
                    <div className="spinner small" />
                  </div>
                ) : thumbnails[cacheKey] ? (
                  <img
                    src={thumbnails[cacheKey]}
                    alt={`Page ${pageNumber}`}
                    className="thumbnail-image"
                  />
                ) : (
                  <div className="thumbnail-placeholder" />
                )}
                {isDeleted && (
                  <div className="deleted-overlay">
                    <span>Deleted</span>
                  </div>
                )}
              </div>
              <span className="thumbnail-number">{pageNumber}</span>
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {selectedPages.size > 1 && (
            <>
              <button onClick={handleExtractSelected}>
                Extract {selectedPages.size} Selected Pages
              </button>
              <div className="context-menu-divider" />
            </>
          )}
          {selectedPages.size <= 1 && onExtractPages && (
            <>
              <button
                onClick={() => {
                  onExtractPages([contextMenu.pageNumber]);
                  closeContextMenu();
                }}
              >
                Extract This Page
              </button>
              <div className="context-menu-divider" />
            </>
          )}
          <button
            onClick={() => {
              rotatePage(contextMenu.pageNumber, 90);
              closeContextMenu();
            }}
          >
            Rotate Clockwise
          </button>
          <button
            onClick={() => {
              rotatePage(contextMenu.pageNumber, -90);
              closeContextMenu();
            }}
          >
            Rotate Counter-clockwise
          </button>
          <div className="context-menu-divider" />
          {state.deletedPages.has(contextMenu.pageNumber) ? (
            <button
              onClick={() => {
                restorePage(contextMenu.pageNumber);
                closeContextMenu();
              }}
            >
              Restore Page
            </button>
          ) : (
            <button
              className="danger"
              onClick={() => {
                deletePage(contextMenu.pageNumber);
                closeContextMenu();
              }}
            >
              Delete Page
            </button>
          )}
        </div>
      )}
      <div
        className="sidebar-resize-handle"
        onMouseDown={handleResizeStart}
      />
    </div>
  );
}

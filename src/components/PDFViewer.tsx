import { useEffect, useState, useRef, useCallback } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { usePDF } from '../contexts/PDFContext';
import { PageCanvas } from './PageCanvas';
import './PDFViewer.css';

interface PDFViewerProps {
  isPrinting?: boolean;
}

export function PDFViewer({ isPrinting }: PDFViewerProps) {
  const { state, settings, pdfDocument, setCurrentPage, setScale, currentTool, fitToPageRequest } = usePDF();
  const [pages, setPages] = useState<Map<number, PDFPageProxy>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const hasSetInitialScale = useRef(false);
  const isScrollingToPage = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const isInitialMount = useRef(true);
  const currentPageRef = useRef(state.currentPage);

  // Pan tool state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });

  // Load pages
  useEffect(() => {
    if (!pdfDocument) {
      setPages(new Map());
      hasSetInitialScale.current = false;
      return;
    }

    const loadPages = async () => {
      const newPages = new Map<number, PDFPageProxy>();
      for (let i = 1; i <= pdfDocument.numPages; i++) {
        try {
          const page = await pdfDocument.getPage(i);
          newPages.set(i, page);
        } catch (error) {
          console.error(`Error loading page ${i}:`, error);
        }
      }
      setPages(newPages);
    };

    loadPages();
  }, [pdfDocument]);

  // Calculate fit-to-page scale when PDF first loads
  useEffect(() => {
    if (hasSetInitialScale.current || pages.size === 0 || !containerRef.current) return;

    const firstPage = pages.get(1);
    if (!firstPage) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth - 40; // Account for padding
    const containerHeight = container.clientHeight - 60; // Account for padding and page indicator

    // Get page dimensions at scale 1
    const viewport = firstPage.getViewport({ scale: 1, rotation: state.rotation });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;

    // Calculate scale to fit page in container
    const scaleX = containerWidth / pageWidth;
    const scaleY = containerHeight / pageHeight;
    const fitScale = Math.min(scaleX, scaleY, 2); // Cap at 200%

    // Round to reasonable value
    const roundedScale = Math.round(fitScale * 100) / 100;

    setScale(Math.max(0.25, roundedScale)); // Minimum 25%
    hasSetInitialScale.current = true;
  }, [pages, state.rotation, setScale]);

  // Respond to fit-to-page requests from menu
  useEffect(() => {
    if (fitToPageRequest === 0 || pages.size === 0 || !containerRef.current) return;

    const firstPage = pages.get(state.currentPage) || pages.get(1);
    if (!firstPage) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth - 40;
    const containerHeight = container.clientHeight - 60;

    const viewport = firstPage.getViewport({ scale: 1, rotation: state.rotation });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;

    const scaleX = containerWidth / pageWidth;
    const scaleY = containerHeight / pageHeight;
    const fitScale = Math.min(scaleX, scaleY, 2);
    const roundedScale = Math.round(fitScale * 100) / 100;

    setScale(Math.max(0.25, roundedScale));
  }, [fitToPageRequest, pages, state.currentPage, state.rotation, setScale]);

  // Scroll to current page when it changes (from toolbar/keyboard navigation)
  useEffect(() => {
    // Skip on initial mount - we don't want to block scroll detection when PDF first loads
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (settings.continuousScroll) {
      const pageEl = pageRefs.current.get(state.currentPage);
      if (pageEl) {
        // Set flag to prevent scroll handler from overriding during animation
        isScrollingToPage.current = true;

        // Clear any existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }

        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Reset flag after scroll animation completes (roughly 500ms for smooth scroll)
        scrollTimeoutRef.current = window.setTimeout(() => {
          isScrollingToPage.current = false;
        }, 500);
      }
    }

    // Cleanup timeout on unmount
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [state.currentPage, settings.continuousScroll]);

  // Keep currentPageRef in sync
  useEffect(() => {
    currentPageRef.current = state.currentPage;
  }, [state.currentPage]);

  // Track visible pages in continuous scroll mode (or print mode)
  const handleScroll = useCallback(() => {
    // Skip if we're programmatically scrolling to a page (prevents fighting with navigation)
    if (!containerRef.current || isScrollingToPage.current) return;
    // Only track scroll when multiple pages are visible (continuous scroll or print mode)
    if (!settings.continuousScroll && !isPrinting) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    let topMostPage = currentPageRef.current; // Use ref instead of state
    let topMostOffset = Infinity;

    pageRefs.current.forEach((el, pageNumber) => {
      // Check if element is still in the DOM
      if (!el.isConnected) return;

      const rect = el.getBoundingClientRect();
      const isVisible =
        rect.top < containerRect.bottom && rect.bottom > containerRect.top;

      if (isVisible) {
        const offset = Math.abs(rect.top - containerRect.top);
        if (offset < topMostOffset) {
          topMostOffset = offset;
          topMostPage = pageNumber;
        }
      }
    });

    if (topMostPage !== currentPageRef.current) {
      setCurrentPage(topMostPage);
    }
  }, [settings.continuousScroll, isPrinting, setCurrentPage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Attach scroll listener when continuous scroll is enabled
    if (!settings.continuousScroll) return;

    // Use IntersectionObserver for more reliable visibility detection
    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingToPage.current) return;

        // Find the most visible page (highest intersection ratio near top)
        let bestPage = currentPageRef.current;
        let bestScore = -Infinity;

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page') || '1', 10);
            // Score based on intersection ratio and proximity to top
            const rect = entry.boundingClientRect;
            const containerRect = container.getBoundingClientRect();
            const distanceFromTop = Math.abs(rect.top - containerRect.top);
            // Higher score for more visible and closer to top
            const score = entry.intersectionRatio * 1000 - distanceFromTop;
            if (score > bestScore) {
              bestScore = score;
              bestPage = pageNum;
            }
          }
        });

        if (bestPage !== currentPageRef.current) {
          setCurrentPage(bestPage);
        }
      },
      {
        root: container,
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: '0px',
      }
    );

    // Observe all page wrappers
    container.querySelectorAll('.page-wrapper').forEach((el) => {
      observer.observe(el);
    });

    // Also keep scroll listener as backup
    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll, settings.continuousScroll, setCurrentPage, pages.size]);

  // Clean up stale refs when rendered pages change
  useEffect(() => {
    // Compute which pages should be rendered (same logic as pagesToRender)
    const pageOrder = state.pageOrder.length > 0
      ? state.pageOrder
      : Array.from({ length: state.numPages }, (_, i) => i + 1);
    const currentPageNumbers = new Set(
      (isPrinting || settings.continuousScroll)
        ? pageOrder.filter((p) => !state.deletedPages.has(p))
        : [state.currentPage]
    );

    // Remove refs for pages no longer rendered
    pageRefs.current.forEach((_, pageNumber) => {
      if (!currentPageNumbers.has(pageNumber)) {
        pageRefs.current.delete(pageNumber);
      }
    });
  }, [isPrinting, settings.continuousScroll, state.pageOrder, state.numPages, state.deletedPages, state.currentPage]);

  // Run scroll detection when pages load to ensure initial sync
  useEffect(() => {
    if (pages.size > 0 && settings.continuousScroll) {
      // Small delay to ensure DOM is updated with page refs
      const timer = setTimeout(() => {
        handleScroll();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [pages.size, settings.continuousScroll, handleScroll]);

  // Pan tool handlers
  const handlePanMouseDown = useCallback((e: React.MouseEvent) => {
    if (currentTool !== 'pan') return;
    const container = containerRef.current;
    if (!container) return;

    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    setScrollStart({ x: container.scrollLeft, y: container.scrollTop });
    e.preventDefault();
  }, [currentTool]);

  const handlePanMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || currentTool !== 'pan') return;
    const container = containerRef.current;
    if (!container) return;

    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    container.scrollLeft = scrollStart.x - dx;
    container.scrollTop = scrollStart.y - dy;
  }, [isPanning, currentTool, panStart, scrollStart]);

  const handlePanMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Clean up panning if mouse leaves
  useEffect(() => {
    const handleMouseUp = () => setIsPanning(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  if (!pdfDocument || pages.size === 0) {
    // Return null - the App routing handles showing WelcomeScreen or EditorEmptyState
    return null;
  }

  // Get pages to render - use pageOrder for ordering
  // When printing, render ALL pages regardless of scroll mode
  const pageOrder = state.pageOrder.length > 0 ? state.pageOrder : Array.from({ length: state.numPages }, (_, i) => i + 1);
  const pagesToRender = (isPrinting || settings.continuousScroll)
    ? pageOrder.filter((p) => !state.deletedPages.has(p))
    : [state.currentPage];

  return (
    <div
      ref={containerRef}
      className={`pdf-viewer ${currentTool === 'pan' ? 'panning' : ''} ${isPanning ? 'is-panning' : ''} ${isPrinting ? 'print-mode' : ''}`}
      onMouseDown={handlePanMouseDown}
      onMouseMove={handlePanMouseMove}
      onMouseUp={handlePanMouseUp}
    >
      <div className="pages-container">
        {pagesToRender.map((pageNumber) => {
          const page = pages.get(pageNumber);
          if (!page) return null;

          return (
            <div
              key={pageNumber}
              ref={(el) => {
                if (el) pageRefs.current.set(pageNumber, el);
              }}
              className={`page-wrapper ${
                state.currentPage === pageNumber ? 'current' : ''
              }`}
              data-page={pageNumber}
            >
              <PageCanvas
                page={page}
                pageNumber={pageNumber}
                scale={state.scale}
                rotation={state.rotation}
              />
              <div className="page-number-indicator">Page {pageNumber}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

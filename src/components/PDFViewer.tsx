import { useEffect, useState, useRef, useCallback } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { usePDF } from '../contexts/PDFContext';
import { PageCanvas } from './PageCanvas';
import './PDFViewer.css';

interface PDFViewerProps {
  isPrinting?: boolean;
}

export function PDFViewer({ isPrinting }: PDFViewerProps) {
  const { state, settings, pdfDocument, setCurrentPage, setScale, currentTool, fitToPageRequest, isProgrammaticNavigation } = usePDF();
  const [pages, setPages] = useState<Map<number, PDFPageProxy>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const hasSetInitialScale = useRef(false);
  const isInitialMount = useRef(true);
  const currentPageRef = useRef(state.currentPage);
  const isProgrammaticNavigationRef = useRef(isProgrammaticNavigation);

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
        // Calculate page distance to determine scroll behavior
        const pageDistance = Math.abs(state.currentPage - currentPageRef.current);

        // Use instant scroll for long jumps (more than 5 pages), smooth for short jumps
        // Long smooth scrolls can take longer than our timeout and cause issues
        const scrollBehavior = pageDistance > 5 ? 'instant' : 'smooth';

        pageEl.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
      }
    }
  }, [state.currentPage, settings.continuousScroll]);

  // Keep refs in sync
  useEffect(() => {
    currentPageRef.current = state.currentPage;
  }, [state.currentPage]);

  useEffect(() => {
    isProgrammaticNavigationRef.current = isProgrammaticNavigation;
  }, [isProgrammaticNavigation]);

  // Track visible pages in continuous scroll mode (or print mode)
  const handleScroll = useCallback(() => {
    // Skip if we're programmatically navigating (prevents fighting with navigation)
    if (!containerRef.current || isProgrammaticNavigationRef.current) return;
    // Only track scroll when multiple pages are visible (continuous scroll or print mode)
    if (!settings.continuousScroll && !isPrinting) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    // Find the page closest to the top of the viewport
    let bestPage = currentPageRef.current;
    let bestDistance = Infinity;

    pageRefs.current.forEach((el, pageNumber) => {
      // Check if element is still in the DOM
      if (!el.isConnected) return;

      const rect = el.getBoundingClientRect();

      // Check if page is at least partially visible
      const isVisible = rect.bottom > containerRect.top && rect.top < containerRect.bottom;
      if (!isVisible) return;

      // Distance from page top to container top (negative means page top is above container)
      const distance = rect.top - containerRect.top;

      // Prefer pages whose top is closest to (but not too far above) the container top
      // Use absolute distance but penalize pages that are mostly scrolled past
      const adjustedDistance = distance < -rect.height * 0.5
        ? Infinity  // Page is more than half scrolled past, ignore it
        : Math.abs(distance);

      if (adjustedDistance < bestDistance) {
        bestDistance = adjustedDistance;
        bestPage = pageNumber;
      }
    });

    if (bestPage !== currentPageRef.current) {
      setCurrentPage(bestPage);
    }
  }, [settings.continuousScroll, isPrinting, setCurrentPage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Attach scroll listener when continuous scroll is enabled
    if (!settings.continuousScroll) return;

    // Use IntersectionObserver to detect which page is most visible
    const observer = new IntersectionObserver(
      () => {
        // Skip if we're programmatically navigating
        if (isProgrammaticNavigationRef.current) return;

        let mostVisiblePage = currentPageRef.current;
        let highestRatio = 0;

        // Check all observed pages for the one with highest visibility
        pageRefs.current.forEach((el, pageNumber) => {
          if (!el.isConnected) return;
          const rect = el.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          // Calculate how much of the page is visible
          const visibleTop = Math.max(rect.top, containerRect.top);
          const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
          const visibleHeight = Math.max(0, visibleBottom - visibleTop);
          const ratio = visibleHeight / rect.height;

          // Prefer pages near the top of the viewport
          const distanceFromTop = rect.top - containerRect.top;
          const topBonus = distanceFromTop < 100 ? 0.5 : 0;

          if (ratio + topBonus > highestRatio) {
            highestRatio = ratio + topBonus;
            mostVisiblePage = pageNumber;
          }
        });

        if (mostVisiblePage !== currentPageRef.current) {
          setCurrentPage(mostVisiblePage);
        }
      },
      {
        root: container,
        threshold: [0.5], // Only fire when page crosses 50% visibility
      }
    );

    // Observe all page wrappers
    container.querySelectorAll('.page-wrapper').forEach((el) => {
      observer.observe(el);
    });

    // Also add scroll listener as backup
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

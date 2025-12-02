import { useState, useCallback, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { PDFProvider, usePDF } from './contexts/PDFContext';
import { MenuBar } from './components/MenuBar';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { PDFViewer } from './components/PDFViewer';
import { WelcomeScreen } from './components/WelcomeScreen';
import { FileDropZone } from './components/FileDropZone';
import { SignaturePad } from './components/SignaturePad';
import { HistoryPanel } from './components/HistoryPanel';
import { SearchPanel } from './components/SearchPanel';
import { KeyboardShortcutsPanel } from './components/KeyboardShortcutsPanel';
import { PageExtractionDialog } from './components/PageExtractionDialog';
import { SplitPDFDialog } from './components/SplitPDFDialog';
import { MergePDFDialog } from './components/MergePDFDialog';
import { LegalPages } from './components/LegalPages';
import { AboutDialog } from './components/AboutDialog';
import { MobileMenu } from './components/MobileMenu';
import { MetadataPanel } from './components/MetadataPanel';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { exportPDF, downloadBlob } from './utils/pdfExport';
import type { Tool } from './types/pdf';
import './App.css';

const DEFAULT_VISIBLE_TOOLS: Tool[] = ['select', 'pan', 'highlight', 'text', 'draw', 'rectangle', 'circle', 'arrow', 'signature', 'image', 'eraser'];

// Component shown when user navigates directly to /editor without a file
function EditorEmptyState({ onOpenFile, isMobile }: { onOpenFile: () => void; isMobile: boolean }) {
  return (
    <div className="editor-empty-state">
      <div className="editor-empty-content">
        <div className="editor-empty-icon">📄</div>
        <h2>No PDF Open</h2>
        <p>
          {isMobile
            ? 'Tap the menu button (⋮) to open a PDF file'
            : 'Use File → Open or drag and drop a PDF to get started'}
        </p>
        <button className="editor-empty-btn" onClick={onOpenFile}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          Open PDF
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const { state, settings, currentTool, loadFile, addAnnotation, setTool, requestFitToPage } = usePDF();
  const navigate = useNavigate();
  const location = useLocation();
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signaturePosition, setSignaturePosition] = useState<{ x: number; y: number; pageNumber: number } | null>(null);
  const [imagePosition, setImagePosition] = useState<{ x: number; y: number; pageNumber: number } | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [visibleTools, setVisibleTools] = useState<Tool[]>(DEFAULT_VISIBLE_TOOLS);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false);
  const [showMetadataPanel, setShowMetadataPanel] = useState(false);
  const [highlightMetadataConcerns, setHighlightMetadataConcerns] = useState(false);
  const [showExtractDialog, setShowExtractDialog] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [extractPreselectedPages, setExtractPreselectedPages] = useState<number[]>([]);
  const [showLegalPage, setShowLegalPage] = useState<'privacy' | 'terms' | null>(null);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts();

  // Additional keyboard shortcuts for panels
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Ctrl+F for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        if (state.file) {
          setShowSearchPanel(true);
        }
      }

      // ? for keyboard shortcuts
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcutsPanel(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.file]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await loadFile(file);
    }
    if (e.target) e.target.value = '';
  }, [loadFile]);

  const handleToggleToolVisibility = useCallback((tool: Tool) => {
    setVisibleTools(prev =>
      prev.includes(tool)
        ? prev.filter(t => t !== tool)
        : [...prev, tool]
    );
  }, []);

  const handleExtractFromSidebar = useCallback((pageNumbers: number[]) => {
    setExtractPreselectedPages(pageNumbers);
    setShowExtractDialog(true);
  }, []);

  // Apply theme class to root element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    if (settings.theme !== 'system') {
      root.classList.add(`theme-${settings.theme}`);
    }
  }, [settings.theme]);

  // Always show the same title
  useEffect(() => {
    document.title = 'PDFEdit.live — Free & Private PDF Editor';
  }, []);

  // Navigate to /editor when a file is loaded
  useEffect(() => {
    if (state.file && location.pathname !== '/editor') {
      navigate('/editor');
    }
  }, [state.file, location.pathname, navigate]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile sidebar when clicking outside
  const handleBackdropClick = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  const toggleMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(prev => !prev);
  }, []);

  // Handle click on PDF when signature or image tool is active
  const handleViewerClick = useCallback((e: React.MouseEvent) => {
    if (currentTool !== 'signature' && currentTool !== 'image') return;

    const target = e.target as HTMLElement;
    const pageWrapper = target.closest('.page-wrapper');
    if (!pageWrapper) return;

    const pageNumber = parseInt(pageWrapper.getAttribute('data-page') || '1', 10);
    const canvas = pageWrapper.querySelector('canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scale = state.scale;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (currentTool === 'signature') {
      setSignaturePosition({ x, y, pageNumber });
      setShowSignaturePad(true);
    } else if (currentTool === 'image') {
      setImagePosition({ x, y, pageNumber });
      imageInputRef.current?.click();
    }
  }, [currentTool, state.scale]);

  const handleSignatureSave = useCallback((dataUrl: string) => {
    if (!signaturePosition) return;

    addAnnotation({
      type: 'signature',
      pageNumber: signaturePosition.pageNumber,
      x: signaturePosition.x,
      y: signaturePosition.y,
      width: 150,
      height: 75,
      content: dataUrl,
    });

    setShowSignaturePad(false);
    setSignaturePosition(null);
    setTool('select');
  }, [signaturePosition, addAnnotation, setTool]);

  const handleSignatureCancel = useCallback(() => {
    setShowSignaturePad(false);
    setSignaturePosition(null);
  }, []);

  // Handle image file selection
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !imagePosition) {
      setImagePosition(null);
      if (e.target) e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        // Create an image to get natural dimensions
        const img = new Image();
        img.onload = () => {
          // Calculate initial size - max 300px width/height, maintain aspect ratio
          const maxSize = 300;
          let width = img.naturalWidth;
          let height = img.naturalHeight;

          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }

          addAnnotation({
            type: 'image',
            pageNumber: imagePosition.pageNumber,
            x: imagePosition.x,
            y: imagePosition.y,
            width,
            height,
            content: dataUrl,
          });

          setImagePosition(null);
          setTool('select');
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  }, [imagePosition, addAnnotation, setTool]);

  // Mobile menu save handler
  const handleMobileSave = useCallback(async () => {
    if (!state.file) return;

    setIsSaving(true);
    try {
      const blob = await exportPDF({
        originalFile: state.file,
        annotations: state.annotations,
        pageRotations: state.pageRotations,
        deletedPages: state.deletedPages,
        pageOrder: state.pageOrder,
        globalRotation: state.rotation,
        metadataOverrides: state.metadataOverrides,
      });

      const baseName = state.fileName.replace(/\.pdf$/i, '');
      downloadBlob(blob, `${baseName}_edited.pdf`);
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save PDF');
    } finally {
      setIsSaving(false);
    }
  }, [state]);

  // Print handler - renders all pages before printing
  const handlePrint = useCallback(() => {
    if (!state.file) return;

    // Set isPrinting to true to render all pages
    setIsPrinting(true);

    // Wait for React to render and all canvases to paint
    // Need to wait for:
    // 1. React to commit render (requestAnimationFrame)
    // 2. Each PageCanvas 50ms debounce to fire
    // 3. Each canvas to actually render (async PDF.js render)
    // Using a generous timeout to ensure all pages are fully rendered
    const numPages = state.numPages - state.deletedPages.size;
    const renderTimePerPage = 150; // Estimate for PDF.js render
    const baseDelay = 200; // Base delay for React render + debounce
    const totalDelay = Math.max(1000, baseDelay + numPages * renderTimePerPage);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          // Force layout/paint
          document.body.offsetHeight;

          // Double-check canvases are ready by forcing another frame
          requestAnimationFrame(() => {
            window.print();
            setIsPrinting(false);
          });
        }, totalDelay);
      });
    });
  }, [state.file, state.numPages, state.deletedPages.size]);

  const showSidebar = settings.showThumbnails && state.file;
  const sidebarOpen = isMobile ? mobileSidebarOpen : true;

  return (
    <FileDropZone>
      <div className="app" onClick={handleViewerClick}>
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />

        <MenuBar
          onOpenFile={() => fileInputRef.current?.click()}
          onMergeFiles={() => setShowMergeDialog(true)}
          visibleTools={visibleTools}
          onToggleToolVisibility={handleToggleToolVisibility}
          onShowHistory={() => setShowHistoryPanel(true)}
          onShowSearch={() => setShowSearchPanel(true)}
          onShowShortcuts={() => setShowShortcutsPanel(true)}
          onExtractPages={() => setShowExtractDialog(true)}
          onSplitPDF={() => setShowSplitDialog(true)}
          onFitToPage={requestFitToPage}
          onShowPrivacy={() => setShowLegalPage('privacy')}
          onShowTerms={() => setShowLegalPage('terms')}
          onShowAbout={() => setShowAboutDialog(true)}
          onPrint={handlePrint}
          onShowMetadata={(highlight) => {
            setHighlightMetadataConcerns(highlight || false);
            setShowMetadataPanel(true);
          }}
        />
        <Toolbar
          isMobile={isMobile}
          onToggleSidebar={toggleMobileSidebar}
          sidebarOpen={mobileSidebarOpen}
          visibleTools={visibleTools}
          onMobileMenuOpen={() => setMobileMenuOpen(true)}
          onPrint={handlePrint}
          onShowSearch={() => setShowSearchPanel(true)}
        />
        <div className="main-content">
          {showSidebar && (
            <>
              <Sidebar isOpen={sidebarOpen} onExtractPages={handleExtractFromSidebar} />
              {isMobile && (
                <div
                  className={`sidebar-backdrop ${mobileSidebarOpen ? 'visible' : ''}`}
                  onClick={handleBackdropClick}
                />
              )}
            </>
          )}
          <Routes>
            <Route
              path="/"
              element={
                <WelcomeScreen
                  onShowPrivacy={() => setShowLegalPage('privacy')}
                  onShowTerms={() => setShowLegalPage('terms')}
                />
              }
            />
            <Route
              path="/editor"
              element={
                state.file ? (
                  <PDFViewer isPrinting={isPrinting} />
                ) : (
                  <EditorEmptyState
                    onOpenFile={() => fileInputRef.current?.click()}
                    isMobile={isMobile}
                  />
                )
              }
            />
          </Routes>
        </div>
        {state.isLoading && (
          <div className="loading-overlay">
            <div className="loading-content">
              <div className="spinner large" />
              <span>Loading PDF...</span>
            </div>
          </div>
        )}
        {state.error && (
          <div className="error-toast">
            <span>Error: {state.error}</span>
          </div>
        )}
        {showSignaturePad && (
          <SignaturePad
            onSave={handleSignatureSave}
            onCancel={handleSignatureCancel}
          />
        )}
        <HistoryPanel
          isOpen={showHistoryPanel}
          onClose={() => setShowHistoryPanel(false)}
        />
        <SearchPanel
          isOpen={showSearchPanel}
          onClose={() => setShowSearchPanel(false)}
        />
        <KeyboardShortcutsPanel
          isOpen={showShortcutsPanel}
          onClose={() => setShowShortcutsPanel(false)}
        />
        <MetadataPanel
          isOpen={showMetadataPanel}
          onClose={() => {
            setShowMetadataPanel(false);
            setHighlightMetadataConcerns(false);
          }}
          highlightConcerns={highlightMetadataConcerns}
        />
        <PageExtractionDialog
          isOpen={showExtractDialog}
          onClose={() => {
            setShowExtractDialog(false);
            setExtractPreselectedPages([]);
          }}
          preselectedPages={extractPreselectedPages}
        />
        <SplitPDFDialog
          isOpen={showSplitDialog}
          onClose={() => setShowSplitDialog(false)}
        />
        <MergePDFDialog
          isOpen={showMergeDialog}
          onClose={() => setShowMergeDialog(false)}
        />
        {showLegalPage && (
          <LegalPages
            page={showLegalPage}
            onClose={() => setShowLegalPage(null)}
          />
        )}
        <AboutDialog
          isOpen={showAboutDialog}
          onClose={() => setShowAboutDialog(false)}
        />
        {isMobile && (
          <MobileMenu
            isOpen={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
            hasFile={!!state.file}
            isSaving={isSaving}
            onOpenFile={() => fileInputRef.current?.click()}
            onSave={handleMobileSave}
            onMergeFiles={() => setShowMergeDialog(true)}
            onExtractPages={() => setShowExtractDialog(true)}
            onSplitPDF={() => setShowSplitDialog(true)}
            onShowAbout={() => setShowAboutDialog(true)}
            currentTool={currentTool}
            onSelectTool={setTool}
          />
        )}
      </div>
    </FileDropZone>
  );
}

function App() {
  return (
    <PDFProvider>
      <AppContent />
    </PDFProvider>
  );
}

export default App;

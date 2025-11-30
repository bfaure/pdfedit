import { useState, useCallback, useEffect, useRef } from 'react';
import { PDFProvider, usePDF } from './contexts/PDFContext';
import { MenuBar } from './components/MenuBar';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { PDFViewer } from './components/PDFViewer';
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
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import type { Tool } from './types/pdf';
import './App.css';

const DEFAULT_VISIBLE_TOOLS: Tool[] = ['select', 'pan', 'highlight', 'text', 'draw', 'rectangle', 'circle', 'arrow', 'signature', 'eraser'];

function AppContent() {
  const { state, settings, currentTool, loadFile, addAnnotation, setTool, requestFitToPage } = usePDF();
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signaturePosition, setSignaturePosition] = useState<{ x: number; y: number; pageNumber: number } | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [visibleTools, setVisibleTools] = useState<Tool[]>(DEFAULT_VISIBLE_TOOLS);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false);
  const [showExtractDialog, setShowExtractDialog] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [extractPreselectedPages, setExtractPreselectedPages] = useState<number[]>([]);
  const [showLegalPage, setShowLegalPage] = useState<'privacy' | 'terms' | null>(null);
  const [showAboutDialog, setShowAboutDialog] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Update page title based on loaded file
  useEffect(() => {
    if (state.file && state.fileName) {
      document.title = state.fileName;
    } else {
      document.title = 'PDFEdit.live — Free & Private PDF Editor';
    }
  }, [state.file, state.fileName]);

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

  // Handle click on PDF when signature tool is active
  const handleViewerClick = useCallback((e: React.MouseEvent) => {
    if (currentTool !== 'signature') return;

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

    setSignaturePosition({ x, y, pageNumber });
    setShowSignaturePad(true);
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
        />
        <Toolbar
          isMobile={isMobile}
          onToggleSidebar={toggleMobileSidebar}
          sidebarOpen={mobileSidebarOpen}
          visibleTools={visibleTools}
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
          <PDFViewer
            onShowPrivacy={() => setShowLegalPage('privacy')}
            onShowTerms={() => setShowLegalPage('terms')}
          />
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

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePDF } from '../contexts/PDFContext';
import { exportPDF, downloadBlob } from '../utils/pdfExport';
import type { Tool } from '../types/pdf';
import './MenuBar.css';

interface MenuBarProps {
  onOpenFile: () => void;
  onMergeFiles: () => void;
  visibleTools: Tool[];
  onToggleToolVisibility: (tool: Tool) => void;
  onShowHistory: () => void;
  onShowSearch: () => void;
  onShowShortcuts: () => void;
  onExtractPages: () => void;
  onSplitPDF: () => void;
  onFitToPage: () => void;
  onShowPrivacy: () => void;
  onShowTerms: () => void;
  onShowAbout: () => void;
  onPrint: () => void;
  onShowMetadata: () => void;
}

interface MenuItem {
  label: string;
  action?: () => void;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
  checked?: boolean;
  submenu?: MenuItem[];
}

const ALL_TOOLS: { id: Tool; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'pan', label: 'Pan' },
  { id: 'highlight', label: 'Highlight' },
  { id: 'text', label: 'Add Text' },
  { id: 'draw', label: 'Draw' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'circle', label: 'Circle' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'signature', label: 'Signature' },
  { id: 'eraser', label: 'Eraser' },
];

export function MenuBar({ onOpenFile, onMergeFiles, visibleTools, onToggleToolVisibility, onShowHistory, onShowSearch, onShowShortcuts, onExtractPages, onSplitPDF, onFitToPage, onShowPrivacy, onShowTerms, onShowAbout, onPrint, onShowMetadata }: MenuBarProps) {
  const {
    state,
    settings,
    canUndo,
    canRedo,
    setScale,
    setRotation,
    rotatePage,
    deletePage,
    restorePage,
    setTool,
    updateSettings,
    undo,
    redo,
    reset,
  } = usePDF();

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const menuBarRef = useRef<HTMLDivElement>(null);

  const isCurrentPageDeleted = state.deletedPages.has(state.currentPage);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = useCallback(async () => {
    if (!state.file) return;

    setIsSaving(true);
    setActiveMenu(null);
    try {
      const blob = await exportPDF({
        originalFile: state.file,
        annotations: state.annotations,
        pageRotations: state.pageRotations,
        deletedPages: state.deletedPages,
        pageOrder: state.pageOrder,
        globalRotation: state.rotation,
        metadataSanitized: state.metadataSanitized,
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

  const handleMenuClick = (menuName: string) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleItemClick = (action?: () => void) => {
    if (action) {
      action();
    }
    setActiveMenu(null);
  };

  const fileMenu: MenuItem[] = [
    { label: 'Open...', action: onOpenFile, shortcut: 'Ctrl+O' },
    { label: 'Merge PDFs...', action: onMergeFiles },
    { label: '', divider: true },
    { label: 'Extract Pages...', action: onExtractPages, disabled: !state.file },
    { label: 'Split PDF...', action: onSplitPDF, disabled: !state.file },
    { label: '', divider: true },
    { label: 'Save', action: handleSave, shortcut: 'Ctrl+S', disabled: !state.file || isSaving },
    {
      label: 'Print',
      action: () => {
        // Brief tip before printing
        const printTip = 'Tip: In the print dialog, disable "Headers and footers" for a cleaner output.';
        if (window.confirm(printTip + '\n\nProceed to print?')) {
          onPrint();
        }
      },
      shortcut: 'Ctrl+P',
      disabled: !state.file
    },
    { label: '', divider: true },
    { label: 'Close', action: reset, disabled: !state.file },
  ];

  const editMenu: MenuItem[] = [
    { label: 'Undo', action: undo, shortcut: 'Ctrl+Z', disabled: !canUndo },
    { label: 'Redo', action: redo, shortcut: 'Ctrl+Y', disabled: !canRedo },
    { label: 'Edit History...', action: onShowHistory, disabled: !state.file },
    { label: '', divider: true },
    { label: 'Find...', action: onShowSearch, shortcut: 'Ctrl+F', disabled: !state.file },
    { label: '', divider: true },
    {
      label: isCurrentPageDeleted ? 'Restore Page' : 'Delete Page',
      action: () => isCurrentPageDeleted ? restorePage(state.currentPage) : deletePage(state.currentPage),
      disabled: !state.file
    },
    { label: '', divider: true },
    { label: 'Rotate Page Clockwise', action: () => rotatePage(state.currentPage, 90), disabled: !state.file },
    { label: 'Rotate Page Counter-clockwise', action: () => rotatePage(state.currentPage, -90), disabled: !state.file },
    { label: '', divider: true },
    { label: 'Rotate All Clockwise', action: () => setRotation(state.rotation + 90), shortcut: 'R', disabled: !state.file },
    { label: 'Rotate All Counter-clockwise', action: () => setRotation(state.rotation - 90), shortcut: 'Shift+R', disabled: !state.file },
    { label: '', divider: true },
    { label: 'Document Metadata...', action: onShowMetadata, disabled: !state.file },
  ];

  const viewMenu: MenuItem[] = [
    { label: 'Zoom In', action: () => setScale(state.scale * 1.25), shortcut: 'Ctrl++', disabled: !state.file },
    { label: 'Zoom Out', action: () => setScale(state.scale * 0.8), shortcut: 'Ctrl+-', disabled: !state.file },
    { label: 'Fit to Page', action: onFitToPage, disabled: !state.file },
    { label: 'Actual Size', action: () => setScale(1), shortcut: 'Ctrl+0', disabled: !state.file },
    { label: '', divider: true },
    { label: '50%', action: () => setScale(0.5), disabled: !state.file },
    { label: '75%', action: () => setScale(0.75), disabled: !state.file },
    { label: '100%', action: () => setScale(1), disabled: !state.file },
    { label: '125%', action: () => setScale(1.25), disabled: !state.file },
    { label: '150%', action: () => setScale(1.5), disabled: !state.file },
    { label: '200%', action: () => setScale(2), disabled: !state.file },
    { label: '', divider: true },
    {
      label: 'Show Thumbnails',
      action: () => updateSettings({ showThumbnails: !settings.showThumbnails }),
      checked: settings.showThumbnails
    },
    {
      label: 'Continuous Scroll',
      action: () => updateSettings({ continuousScroll: !settings.continuousScroll }),
      checked: settings.continuousScroll
    },
    { label: '', divider: true },
    {
      label: 'Light Theme',
      action: () => updateSettings({ theme: 'light' }),
      checked: settings.theme === 'light'
    },
    {
      label: 'Dark Theme',
      action: () => updateSettings({ theme: 'dark' }),
      checked: settings.theme === 'dark'
    },
    {
      label: 'System Theme',
      action: () => updateSettings({ theme: 'system' }),
      checked: settings.theme === 'system'
    },
  ];

  const toolsMenu: MenuItem[] = [
    ...ALL_TOOLS.map((tool) => ({
      label: tool.label,
      action: () => setTool(tool.id),
      checked: false,
    })),
    { label: '', divider: true },
    { label: 'Customize Toolbar...', action: () => {}, disabled: true },
    { label: '', divider: true },
    ...ALL_TOOLS.map((tool) => ({
      label: `Show ${tool.label} in Toolbar`,
      action: () => onToggleToolVisibility(tool.id),
      checked: visibleTools.includes(tool.id),
    })),
  ];

  const helpMenu: MenuItem[] = [
    { label: 'Keyboard Shortcuts', action: onShowShortcuts, shortcut: '?' },
    { label: '', divider: true },
    { label: 'Privacy Policy', action: onShowPrivacy },
    { label: 'Terms of Service', action: onShowTerms },
    { label: '', divider: true },
    { label: 'About PDFEdit.live', action: onShowAbout },
  ];

  const renderMenu = (items: MenuItem[]) => (
    <div className="menu-dropdown">
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={index} className="menu-divider" />;
        }
        return (
          <button
            key={index}
            className={`menu-item ${item.disabled ? 'disabled' : ''} ${item.checked ? 'checked' : ''}`}
            onClick={() => !item.disabled && handleItemClick(item.action)}
            disabled={item.disabled}
          >
            <span className="menu-item-check">{item.checked ? '✓' : ''}</span>
            <span className="menu-item-label">{item.label}</span>
            {item.shortcut && <span className="menu-item-shortcut">{item.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );

  const menus = [
    { name: 'File', items: fileMenu },
    { name: 'Edit', items: editMenu },
    { name: 'View', items: viewMenu },
    { name: 'Tools', items: toolsMenu },
    { name: 'Help', items: helpMenu },
  ];

  return (
    <div className="menu-bar" ref={menuBarRef}>
      {menus.map((menu) => (
        <div key={menu.name} className="menu-container">
          <button
            className={`menu-button ${activeMenu === menu.name ? 'active' : ''}`}
            onClick={() => handleMenuClick(menu.name)}
            onMouseEnter={() => activeMenu && setActiveMenu(menu.name)}
          >
            {menu.name}
          </button>
          {activeMenu === menu.name && renderMenu(menu.items)}
        </div>
      ))}
      <div className="menu-bar-spacer" />
      {state.file && (
        <span className="menu-bar-filename" title={state.fileName}>
          {state.fileName}
        </span>
      )}
      <a
        href="https://buymeacoffee.com/pdfedit"
        target="_blank"
        rel="noopener noreferrer"
        className="donate-link"
        title="Support this project"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
          <line x1="6" y1="1" x2="6" y2="4"/>
          <line x1="10" y1="1" x2="10" y2="4"/>
          <line x1="14" y1="1" x2="14" y2="4"/>
        </svg>
        <span>Buy me a coffee</span>
      </a>
    </div>
  );
}

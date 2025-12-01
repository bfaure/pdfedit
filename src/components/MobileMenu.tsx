import { useEffect, useRef } from 'react';
import type { Tool } from '../types/pdf';
import './MobileMenu.css';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  hasFile: boolean;
  isSaving: boolean;
  onOpenFile: () => void;
  onSave: () => void;
  onMergeFiles: () => void;
  onExtractPages: () => void;
  onSplitPDF: () => void;
  onShowAbout: () => void;
  currentTool: Tool;
  onSelectTool: (tool: Tool) => void;
}

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: 'select', icon: '☝', label: 'Select' },
  { id: 'pan', icon: '✋', label: 'Pan' },
  { id: 'highlight', icon: '🖍', label: 'Highlight' },
  { id: 'text', icon: 'T', label: 'Add Text' },
  { id: 'draw', icon: '✏', label: 'Draw' },
  { id: 'rectangle', icon: '▢', label: 'Rectangle' },
  { id: 'circle', icon: '○', label: 'Circle' },
  { id: 'arrow', icon: '→', label: 'Arrow' },
  { id: 'signature', icon: '✍', label: 'Signature' },
  { id: 'eraser', icon: '🧹', label: 'Eraser' },
];

export function MobileMenu({
  isOpen,
  onClose,
  hasFile,
  isSaving,
  onOpenFile,
  onSave,
  onMergeFiles,
  onExtractPages,
  onSplitPDF,
  onShowAbout,
  currentTool,
  onSelectTool,
}: MobileMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleItemClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <>
      <div className="mobile-menu-backdrop" onClick={onClose} />
      <div className="mobile-menu" ref={menuRef}>
        <button
          className="mobile-menu-item"
          onClick={() => handleItemClick(onOpenFile)}
        >
          <span className="mobile-menu-icon">📂</span>
          <span>Open File</span>
        </button>

        <button
          className="mobile-menu-item"
          onClick={() => handleItemClick(onSave)}
          disabled={!hasFile || isSaving}
        >
          <span className="mobile-menu-icon">💾</span>
          <span>{isSaving ? 'Saving...' : 'Save'}</span>
        </button>

        <div className="mobile-menu-divider" />

        <button
          className="mobile-menu-item"
          onClick={() => handleItemClick(onMergeFiles)}
        >
          <span className="mobile-menu-icon">📑</span>
          <span>Merge PDFs</span>
        </button>

        <button
          className="mobile-menu-item"
          onClick={() => handleItemClick(onExtractPages)}
          disabled={!hasFile}
        >
          <span className="mobile-menu-icon">📤</span>
          <span>Extract Pages</span>
        </button>

        <button
          className="mobile-menu-item"
          onClick={() => handleItemClick(onSplitPDF)}
          disabled={!hasFile}
        >
          <span className="mobile-menu-icon">✂️</span>
          <span>Split PDF</span>
        </button>

        {hasFile && (
          <>
            <div className="mobile-menu-divider" />
            <div className="mobile-menu-label">Tools</div>
            <div className="mobile-menu-tools">
              {TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  className={`mobile-tool-btn ${currentTool === tool.id ? 'active' : ''}`}
                  onClick={() => {
                    onSelectTool(tool.id);
                    onClose();
                  }}
                  title={tool.label}
                >
                  <span className="mobile-tool-icon">{tool.icon}</span>
                  <span className="mobile-tool-label">{tool.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mobile-menu-divider" />

        <button
          className="mobile-menu-item"
          onClick={() => handleItemClick(onShowAbout)}
        >
          <span className="mobile-menu-icon">ℹ️</span>
          <span>About</span>
        </button>
      </div>
    </>
  );
}

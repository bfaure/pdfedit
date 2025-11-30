import React from 'react';
import { usePDF } from '../contexts/PDFContext';
import type { Tool } from '../types/pdf';
import './Toolbar.css';

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

interface ToolbarProps {
  isMobile?: boolean;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  visibleTools?: Tool[];
}

export function Toolbar({ isMobile, onToggleSidebar, sidebarOpen, visibleTools }: ToolbarProps) {
  const {
    state,
    settings,
    currentTool,
    canUndo,
    canRedo,
    setCurrentPage,
    setScale,
    deletePage,
    restorePage,
    setTool,
    updateSettings,
    undo,
    redo,
  } = usePDF();

  const handleZoomIn = () => {
    const nextZoom = ZOOM_LEVELS.find((z) => z > state.scale) || state.scale * 1.25;
    setScale(nextZoom);
  };

  const handleZoomOut = () => {
    const nextZoom = [...ZOOM_LEVELS].reverse().find((z) => z < state.scale) || state.scale * 0.8;
    setScale(nextZoom);
  };

  const handlePageChange = (delta: number) => {
    setCurrentPage(state.currentPage + delta);
  };

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value, 10);
    if (!isNaN(page)) {
      setCurrentPage(page);
    }
  };

  const handleDeleteCurrentPage = () => {
    if (state.deletedPages.has(state.currentPage)) {
      restorePage(state.currentPage);
    } else {
      deletePage(state.currentPage);
    }
  };

  const isCurrentPageDeleted = state.deletedPages.has(state.currentPage);
  const deletedCount = state.deletedPages.size;

  const eraserIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8l10-10c.8-.8 2-.8 2.8 0l5.2 5.2c.8.8.8 2 0 2.8L13 19" />
      <path d="M7 20l-4-4" />
    </svg>
  );

  const allTools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: '☝', label: 'Select' },
    { id: 'pan', icon: '✋', label: 'Pan' },
    { id: 'highlight', icon: '🖍', label: 'Highlight' },
    { id: 'text', icon: 'T', label: 'Add Text' },
    { id: 'draw', icon: '✏', label: 'Draw' },
    { id: 'rectangle', icon: '▢', label: 'Rectangle' },
    { id: 'circle', icon: '○', label: 'Circle' },
    { id: 'arrow', icon: '→', label: 'Arrow' },
    { id: 'signature', icon: '✍', label: 'Signature' },
    { id: 'eraser', icon: eraserIcon, label: 'Eraser' },
  ];

  // Filter tools based on visibleTools prop
  const tools = visibleTools
    ? allTools.filter(tool => visibleTools.includes(tool.id))
    : allTools;

  // Show minimal toolbar when no file is loaded
  if (!state.file) {
    return (
      <div className="toolbar">
        <div className="toolbar-section">
          <span className="toolbar-hint">Use File menu to open a PDF</span>
        </div>
        <div className="toolbar-spacer" />
        <div className="toolbar-section">
          <button
            className="toolbar-btn"
            onClick={() => {
              const currentTheme = settings.theme;
              const nextTheme = currentTheme === 'light' ? 'dark' : currentTheme === 'dark' ? 'system' : 'light';
              updateSettings({ theme: nextTheme });
            }}
            title={`Theme: ${settings.theme}`}
          >
            {settings.theme === 'light' ? '☀️' : settings.theme === 'dark' ? '🌙' : '🖥️'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="toolbar">
      {/* Mobile sidebar toggle */}
      {isMobile && settings.showThumbnails && (
        <button
          className={`toolbar-btn mobile-menu-btn ${sidebarOpen ? 'active' : ''}`}
          onClick={onToggleSidebar}
          title="Toggle Pages"
        >
          ☰
        </button>
      )}

      <div className="toolbar-section">
        <button
          className="toolbar-btn"
          onClick={() => handlePageChange(-1)}
          disabled={state.currentPage <= 1}
          title="Previous Page"
        >
          ◀
        </button>
        <div className="page-indicator">
          <input
            type="number"
            min={1}
            max={state.numPages}
            value={state.currentPage}
            onChange={handlePageInput}
            className="page-input"
          />
          <span>/ {state.numPages}</span>
        </div>
        <button
          className="toolbar-btn"
          onClick={() => handlePageChange(1)}
          disabled={state.currentPage >= state.numPages}
          title="Next Page"
        >
          ▶
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button
          className="toolbar-btn"
          onClick={handleZoomOut}
          disabled={state.scale <= 0.25}
          title="Zoom Out"
        >
          −
        </button>
        <select
          className="zoom-select"
          value={state.scale}
          onChange={(e) => setScale(parseFloat(e.target.value))}
        >
          {ZOOM_LEVELS.map((level) => (
            <option key={level} value={level}>
              {Math.round(level * 100)}%
            </option>
          ))}
        </select>
        <button
          className="toolbar-btn"
          onClick={handleZoomIn}
          disabled={state.scale >= 5}
          title="Zoom In"
        >
          +
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button
          className={`toolbar-btn ${isCurrentPageDeleted ? 'danger-active' : ''}`}
          onClick={handleDeleteCurrentPage}
          title={isCurrentPageDeleted ? "Restore Page" : "Delete Page"}
        >
          {isCurrentPageDeleted ? '♻️' : '🗑️'}
          {!isMobile && <span className="btn-text"> {isCurrentPageDeleted ? 'Restore' : 'Delete'}</span>}
        </button>
        {deletedCount > 0 && (
          <span className="deleted-count" title="Pages marked for deletion">
            {deletedCount}{!isMobile && ' deleted'}
          </span>
        )}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section tools">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`toolbar-btn tool-btn ${currentTool === tool.id ? 'active' : ''}`}
            onClick={() => setTool(tool.id)}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button
          className="toolbar-btn"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          className="toolbar-btn"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          ↪
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button
          className={`toolbar-btn ${settings.showThumbnails ? 'active' : ''}`}
          onClick={() => updateSettings({ showThumbnails: !settings.showThumbnails })}
          title="Toggle Thumbnails"
        >
          ▤
        </button>
        <button
          className={`toolbar-btn ${settings.continuousScroll ? 'active' : ''}`}
          onClick={() => updateSettings({ continuousScroll: !settings.continuousScroll })}
          title="Toggle Continuous Scroll"
        >
          📜
        </button>
        <button
          className="toolbar-btn"
          onClick={() => window.print()}
          title="Print"
        >
          🖨️
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-section">
        <button
          className="toolbar-btn"
          onClick={() => {
            const currentTheme = settings.theme;
            const nextTheme = currentTheme === 'light' ? 'dark' : currentTheme === 'dark' ? 'system' : 'light';
            updateSettings({ theme: nextTheme });
          }}
          title={`Theme: ${settings.theme}`}
        >
          {settings.theme === 'light' ? '☀️' : settings.theme === 'dark' ? '🌙' : '🖥️'}
        </button>
      </div>
    </div>
  );
}

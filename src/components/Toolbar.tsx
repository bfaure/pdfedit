import React, { useState, useRef, useEffect } from 'react';
import { usePDF } from '../contexts/PDFContext';
import type { Tool } from '../types/pdf';
import './Toolbar.css';

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

interface ToolbarProps {
  isMobile?: boolean;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  visibleTools?: Tool[];
  onMobileMenuOpen?: () => void;
  onPrint?: () => void;
  onShowSearch?: () => void;
}

export function Toolbar({ isMobile, onToggleSidebar, sidebarOpen, visibleTools, onMobileMenuOpen, onPrint, onShowSearch }: ToolbarProps) {
  const {
    state,
    settings,
    currentTool,
    canUndo,
    canRedo,
    setCurrentPage,
    setScale,
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

  // Shapes dropdown state
  const [shapesOpen, setShapesOpen] = useState(false);
  const shapesRef = useRef<HTMLDivElement>(null);

  // Close shapes dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shapesRef.current && !shapesRef.current.contains(e.target as Node)) {
        setShapesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const eraserIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8l10-10c.8-.8 2-.8 2.8 0l5.2 5.2c.8.8.8 2 0 2.8L13 19" />
      <path d="M7 20l-4-4" />
    </svg>
  );

  // Shape tools (collapsed into dropdown)
  const shapeTools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'rectangle', icon: '▢', label: 'Rectangle' },
    { id: 'circle', icon: '○', label: 'Circle' },
    { id: 'arrow', icon: '→', label: 'Arrow' },
  ];

  // Main tools (excluding shapes)
  const mainTools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: '☝', label: 'Select' },
    { id: 'pan', icon: '✋', label: 'Pan' },
    { id: 'highlight', icon: '🖍', label: 'Highlight' },
    { id: 'text', icon: 'T', label: 'Add Text' },
    { id: 'draw', icon: '✏', label: 'Draw' },
    { id: 'signature', icon: '✍', label: 'Signature' },
    { id: 'eraser', icon: eraserIcon, label: 'Eraser' },
  ];

  // Filter tools based on visibleTools prop
  const tools = visibleTools
    ? mainTools.filter(tool => visibleTools.includes(tool.id))
    : mainTools;

  const shapes = visibleTools
    ? shapeTools.filter(tool => visibleTools.includes(tool.id))
    : shapeTools;

  // Check if any shape tool is currently selected
  const isShapeToolSelected = shapeTools.some(t => t.id === currentTool);
  const selectedShapeTool = shapeTools.find(t => t.id === currentTool);

  // Show minimal toolbar when no file is loaded
  if (!state.file) {
    return (
      <div className="toolbar">
        <div className="toolbar-section">
          {!isMobile && <span className="toolbar-hint">Use File menu to open a PDF</span>}
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

      {/* Hide tools section on mobile - tools are in the mobile menu */}
      {!isMobile && (
        <>
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

            {/* Shapes dropdown */}
            {shapes.length > 0 && (
              <div className="shapes-dropdown" ref={shapesRef}>
                <button
                  className={`toolbar-btn tool-btn shapes-btn ${isShapeToolSelected ? 'active' : ''}`}
                  onClick={() => setShapesOpen(!shapesOpen)}
                  title="Shapes"
                >
                  {selectedShapeTool ? selectedShapeTool.icon : '⬡'}
                  <span className="dropdown-arrow">▾</span>
                </button>
                {shapesOpen && (
                  <div className="shapes-menu">
                    {shapes.map((shape) => (
                      <button
                        key={shape.id}
                        className={`shapes-menu-item ${currentTool === shape.id ? 'active' : ''}`}
                        onClick={() => {
                          setTool(shape.id);
                          setShapesOpen(false);
                        }}
                      >
                        <span className="shape-icon">{shape.icon}</span>
                        <span className="shape-label">{shape.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

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
          onClick={onPrint}
          title="Print"
        >
          🖨️
        </button>
        <button
          className="toolbar-btn"
          onClick={onShowSearch}
          title="Search (Ctrl+F)"
        >
          🔍
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

      {/* Mobile menu button */}
      {isMobile && (
        <button
          className="toolbar-btn mobile-more-btn"
          onClick={onMobileMenuOpen}
          title="More options"
        >
          ⋮
        </button>
      )}
    </div>
  );
}

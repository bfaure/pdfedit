import './KeyboardShortcutsPanel.css';

interface KeyboardShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  {
    category: 'Navigation',
    items: [
      { keys: ['←', 'PageUp'], description: 'Previous page' },
      { keys: ['→', 'PageDown'], description: 'Next page' },
      { keys: ['Home'], description: 'First page' },
      { keys: ['End'], description: 'Last page' },
    ],
  },
  {
    category: 'Zoom',
    items: [
      { keys: ['Ctrl', '+'], description: 'Zoom in' },
      { keys: ['Ctrl', '-'], description: 'Zoom out' },
      { keys: ['Ctrl', '0'], description: 'Reset zoom (100%)' },
    ],
  },
  {
    category: 'File',
    items: [
      { keys: ['Ctrl', 'O'], description: 'Open file' },
      { keys: ['Ctrl', 'S'], description: 'Save/Export' },
      { keys: ['Ctrl', 'P'], description: 'Print' },
      { keys: ['Ctrl', 'F'], description: 'Find/Search' },
    ],
  },
  {
    category: 'Edit',
    items: [
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Y'], description: 'Redo' },
      { keys: ['R'], description: 'Rotate all clockwise' },
      { keys: ['Shift', 'R'], description: 'Rotate all counter-clockwise' },
    ],
  },
  {
    category: 'Tools',
    items: [
      { keys: ['V'], description: 'Select tool' },
      { keys: ['H'], description: 'Pan/Hand tool' },
      { keys: ['M'], description: 'Highlight' },
      { keys: ['T'], description: 'Text' },
      { keys: ['P'], description: 'Draw/Pen' },
      { keys: ['U'], description: 'Rectangle' },
      { keys: ['O'], description: 'Circle/Ellipse' },
      { keys: ['A'], description: 'Arrow' },
      { keys: ['E'], description: 'Eraser' },
      { keys: ['Esc'], description: 'Deselect / Close panel' },
    ],
  },
  {
    category: 'View',
    items: [
      { keys: ['?'], description: 'Show this panel' },
    ],
  },
];

export function KeyboardShortcutsPanel({ isOpen, onClose }: KeyboardShortcutsPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="shortcuts-close" onClick={onClose}>×</button>
        </div>
        <div className="shortcuts-content">
          {SHORTCUTS.map((section) => (
            <div key={section.category} className="shortcuts-section">
              <h3 className="shortcuts-category">{section.category}</h3>
              <div className="shortcuts-list">
                {section.items.map((item, idx) => (
                  <div key={idx} className="shortcut-item">
                    <div className="shortcut-keys">
                      {item.keys.map((key, keyIdx) => (
                        <span key={keyIdx}>
                          <kbd className="shortcut-key">{key}</kbd>
                          {keyIdx < item.keys.length - 1 && <span className="key-separator">+</span>}
                        </span>
                      ))}
                    </div>
                    <span className="shortcut-description">{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="shortcuts-footer">
          <span>Press <kbd>?</kbd> or <kbd>Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}

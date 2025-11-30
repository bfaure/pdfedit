import { usePDF } from '../contexts/PDFContext';
import './HistoryPanel.css';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACTION_ICONS: Record<string, string> = {
  add_annotation: '+',
  update_annotation: '~',
  delete_annotation: '-',
  rotate_page: '↻',
  delete_page: '🗑',
  restore_page: '♻',
  reorder_pages: '↕',
  rotate_all: '↻',
};

export function HistoryPanel({ isOpen, onClose }: HistoryPanelProps) {
  const { history, historyIndex, undo, redo, canUndo, canRedo } = usePDF();

  if (!isOpen) return null;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="history-panel-overlay" onClick={onClose}>
      <div className="history-panel" onClick={(e) => e.stopPropagation()}>
        <div className="history-panel-header">
          <h3>Edit History</h3>
          <button className="history-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="history-panel-actions">
          <button
            className="history-action-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↩ Undo
          </button>
          <button
            className="history-action-btn"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            ↪ Redo
          </button>
        </div>

        <div className="history-list">
          {history.length === 0 ? (
            <div className="history-empty">
              <span className="history-empty-icon">📝</span>
              <p>No changes yet</p>
              <p className="history-empty-hint">Your edit history will appear here</p>
            </div>
          ) : (
            <>
              {/* Current state indicator */}
              {historyIndex === history.length - 1 && (
                <div className="history-item current-state">
                  <span className="history-icon">●</span>
                  <span className="history-description">Current State</span>
                </div>
              )}

              {/* History entries in reverse order (newest first) */}
              {[...history].reverse().map((entry, reverseIdx) => {
                const idx = history.length - 1 - reverseIdx;
                const isCurrent = idx === historyIndex;
                const isPast = idx < historyIndex;
                const isFuture = idx > historyIndex;

                return (
                  <div
                    key={entry.id}
                    className={`history-item ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''} ${isFuture ? 'future' : ''}`}
                    title={isFuture ? 'Redo to reach this state' : isPast ? 'Undo to return to this state' : 'Current position'}
                  >
                    <span className="history-icon">{ACTION_ICONS[entry.type] || '•'}</span>
                    <div className="history-content">
                      <span className="history-description">{entry.description}</span>
                      <span className="history-time">{formatTime(entry.timestamp)}</span>
                    </div>
                    {isCurrent && <span className="history-current-marker">◄</span>}
                  </div>
                );
              })}

              {/* Initial state */}
              <div className={`history-item initial ${historyIndex === -1 ? 'current' : 'past'}`}>
                <span className="history-icon">○</span>
                <span className="history-description">Document opened</span>
                {historyIndex === -1 && <span className="history-current-marker">◄</span>}
              </div>
            </>
          )}
        </div>

        <div className="history-panel-footer">
          <span className="history-count">
            {history.length} change{history.length !== 1 ? 's' : ''}
            {historyIndex >= 0 && ` (at ${historyIndex + 1})`}
          </span>
        </div>
      </div>
    </div>
  );
}

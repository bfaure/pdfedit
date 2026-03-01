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

const ACTION_LABELS: Record<string, string> = {
  add_annotation: 'Added',
  update_annotation: 'Modified',
  delete_annotation: 'Removed',
  rotate_page: 'Rotated',
  delete_page: 'Deleted',
  restore_page: 'Restored',
  reorder_pages: 'Reordered',
  rotate_all: 'Rotated All',
};

export function HistoryPanel({ isOpen, onClose }: HistoryPanelProps) {
  const { history, historyIndex, undo, redo, canUndo, canRedo, jumpToHistory, clearHistory } = usePDF();

  if (!isOpen) return null;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleJump = (targetIndex: number) => {
    if (targetIndex !== historyIndex) {
      jumpToHistory(targetIndex);
    }
  };

  const handleClear = () => {
    clearHistory();
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
          {history.length > 0 && (
            <button
              className="history-action-btn history-clear-btn"
              onClick={handleClear}
              title="Clear all history"
            >
              ✕ Clear
            </button>
          )}
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
              {/* History entries in reverse order (newest first) */}
              {[...history].reverse().map((entry, reverseIdx) => {
                const idx = history.length - 1 - reverseIdx;
                const isCurrent = idx === historyIndex;
                const isPast = idx < historyIndex;
                const isFuture = idx > historyIndex;

                return (
                  <div
                    key={entry.id}
                    className={`history-item clickable ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''} ${isFuture ? 'future' : ''}`}
                    onClick={() => handleJump(idx)}
                    title={isCurrent ? 'Current state' : `Click to jump to this state`}
                  >
                    <span className={`history-icon ${entry.type}`}>{ACTION_ICONS[entry.type] || '•'}</span>
                    <div className="history-content">
                      <span className="history-type-label">{ACTION_LABELS[entry.type] || entry.type}</span>
                      <span className="history-description">{entry.description}</span>
                      <span className="history-time">{formatTime(entry.timestamp)}</span>
                    </div>
                    {isCurrent && <span className="history-current-marker">◄</span>}
                  </div>
                );
              })}

              {/* Initial state */}
              <div
                className={`history-item initial clickable ${historyIndex === -1 ? 'current' : 'past'}`}
                onClick={() => handleJump(-1)}
                title={historyIndex === -1 ? 'Current state (original document)' : 'Click to revert to original document'}
              >
                <span className="history-icon initial-icon">○</span>
                <div className="history-content">
                  <span className="history-type-label">Original</span>
                  <span className="history-description">Document opened</span>
                </div>
                {historyIndex === -1 && <span className="history-current-marker">◄</span>}
              </div>
            </>
          )}
        </div>

        <div className="history-panel-footer">
          <span className="history-count">
            {history.length} change{history.length !== 1 ? 's' : ''}
            {historyIndex >= 0 && ` · Position ${historyIndex + 1} of ${history.length}`}
          </span>
          {history.length > 0 && (
            <span className="history-hint">Click any entry to jump to that state</span>
          )}
        </div>
      </div>
    </div>
  );
}

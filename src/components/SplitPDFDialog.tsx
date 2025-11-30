import { useState, useCallback } from 'react';
import { usePDF } from '../contexts/PDFContext';
import { splitPDF, downloadBlob } from '../utils/pdfExport';
import './DialogStyles.css';

interface SplitPDFDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SplitPDFDialog({ isOpen, onClose }: SplitPDFDialogProps) {
  const { state } = usePDF();
  const [splitMode, setSplitMode] = useState<'pages' | 'count'>('pages');
  const [splitAfterPages, setSplitAfterPages] = useState('');
  const [pagesPerPart, setPagesPerPart] = useState('1');
  const [isSplitting, setIsSplitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseSplitPoints = useCallback((): number[] => {
    if (splitMode === 'count') {
      const count = parseInt(pagesPerPart, 10);
      if (isNaN(count) || count < 1) return [];

      const points: number[] = [];
      for (let i = count; i < state.numPages; i += count) {
        points.push(i);
      }
      return points;
    } else {
      const points: number[] = [];
      const parts = splitAfterPages.split(',').map(s => s.trim()).filter(Boolean);

      for (const part of parts) {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num < state.numPages) {
          points.push(num);
        }
      }

      return [...new Set(points)].sort((a, b) => a - b);
    }
  }, [splitMode, splitAfterPages, pagesPerPart, state.numPages]);

  const handleSplit = useCallback(async () => {
    if (!state.file) return;

    const splitPoints = parseSplitPoints();
    if (splitPoints.length === 0) {
      setError('Please enter valid split points');
      return;
    }

    setIsSplitting(true);
    setError(null);

    try {
      const parts = await splitPDF(state.file, splitPoints);

      // Download each part
      for (const part of parts) {
        downloadBlob(part.blob, part.name);
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to split PDF');
    } finally {
      setIsSplitting(false);
    }
  }, [state.file, parseSplitPoints, onClose]);

  const getPreviewParts = useCallback(() => {
    const splitPoints = parseSplitPoints();
    if (splitPoints.length === 0) return [];

    const points = [0, ...splitPoints, state.numPages];
    const parts: Array<{ start: number; end: number }> = [];

    for (let i = 0; i < points.length - 1; i++) {
      parts.push({
        start: points[i] + 1,
        end: points[i + 1],
      });
    }

    return parts;
  }, [parseSplitPoints, state.numPages]);

  if (!isOpen) return null;

  const previewParts = getPreviewParts();

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Split PDF</h2>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>
        <div className="dialog-content">
          <p className="dialog-description">
            Split your PDF into multiple smaller files. Each part will be downloaded separately.
          </p>

          <div className="form-group">
            <label>Split method:</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="splitMode"
                  checked={splitMode === 'pages'}
                  onChange={() => setSplitMode('pages')}
                />
                <span>Split after specific pages</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="splitMode"
                  checked={splitMode === 'count'}
                  onChange={() => setSplitMode('count')}
                />
                <span>Split every N pages</span>
              </label>
            </div>
          </div>

          {splitMode === 'pages' ? (
            <div className="form-group">
              <label htmlFor="splitAfter">Split after page(s):</label>
              <input
                id="splitAfter"
                type="text"
                className="dialog-input"
                placeholder="e.g., 3, 7, 12"
                value={splitAfterPages}
                onChange={(e) => {
                  setSplitAfterPages(e.target.value);
                  setError(null);
                }}
              />
              <span className="form-hint">
                Enter page numbers where the document should be split (1-{state.numPages - 1})
              </span>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="pagesPerPart">Pages per part:</label>
              <input
                id="pagesPerPart"
                type="number"
                className="dialog-input"
                min="1"
                max={state.numPages}
                value={pagesPerPart}
                onChange={(e) => {
                  setPagesPerPart(e.target.value);
                  setError(null);
                }}
              />
              <span className="form-hint">
                The document will be split into parts of this many pages
              </span>
            </div>
          )}

          {previewParts.length > 0 && (
            <div className="preview-info">
              <strong>{previewParts.length}</strong> file{previewParts.length !== 1 ? 's' : ''} will be created:
              <div className="split-preview">
                {previewParts.map((part, idx) => (
                  <div key={idx} className="split-part">
                    <span className="part-label">Part {idx + 1}:</span>
                    <span className="part-pages">
                      {part.start === part.end
                        ? `Page ${part.start}`
                        : `Pages ${part.start}-${part.end}`}
                    </span>
                    <span className="part-count">
                      ({part.end - part.start + 1} page{part.end - part.start + 1 !== 1 ? 's' : ''})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div className="dialog-error">{error}</div>}
        </div>
        <div className="dialog-footer">
          <button className="dialog-btn secondary" onClick={onClose}>Cancel</button>
          <button
            className="dialog-btn primary"
            onClick={handleSplit}
            disabled={isSplitting || previewParts.length === 0}
          >
            {isSplitting ? 'Splitting...' : 'Split PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

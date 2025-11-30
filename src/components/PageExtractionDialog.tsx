import { useState, useCallback, useEffect } from 'react';
import { usePDF } from '../contexts/PDFContext';
import { extractPages, downloadBlob } from '../utils/pdfExport';
import './DialogStyles.css';

interface PageExtractionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedPages?: number[];
}

export function PageExtractionDialog({ isOpen, onClose, preselectedPages = [] }: PageExtractionDialogProps) {
  const { state } = usePDF();
  const [pageRange, setPageRange] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill page range when dialog opens with preselected pages
  useEffect(() => {
    if (isOpen && preselectedPages.length > 0) {
      // Format preselected pages as a range string
      const formatted = formatPageNumbers(preselectedPages);
      setPageRange(formatted);
    } else if (!isOpen) {
      setPageRange('');
      setError(null);
    }
  }, [isOpen, preselectedPages]);

  // Format page numbers into a concise string (e.g., "1-3, 5, 7-9")
  function formatPageNumbers(pages: number[]): string {
    if (pages.length === 0) return '';
    const sorted = [...pages].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i <= sorted.length; i++) {
      if (i < sorted.length && sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? String(start) : `${start}-${end}`);
        if (i < sorted.length) {
          start = sorted[i];
          end = sorted[i];
        }
      }
    }
    return ranges.join(', ');
  }

  const parsePageRange = useCallback((input: string): number[] => {
    const pages: Set<number> = new Set();
    const parts = input.split(',').map(s => s.trim()).filter(Boolean);

    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(s => parseInt(s.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i >= 1 && i <= state.numPages) {
              pages.add(i);
            }
          }
        }
      } else {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= state.numPages) {
          pages.add(num);
        }
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  }, [state.numPages]);

  const handleExtract = useCallback(async () => {
    if (!state.file) return;

    const pages = parsePageRange(pageRange);
    if (pages.length === 0) {
      setError('Please enter valid page numbers');
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const blob = await extractPages(state.file, pages);
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      const pageDesc = pages.length === 1 ? `page${pages[0]}` : `pages${pages[0]}-${pages[pages.length - 1]}`;
      downloadBlob(blob, `${baseName}_${pageDesc}.pdf`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract pages');
    } finally {
      setIsExtracting(false);
    }
  }, [state.file, state.fileName, pageRange, parsePageRange, onClose]);

  const handleQuickSelect = useCallback((type: 'odd' | 'even' | 'first' | 'last' | 'current') => {
    switch (type) {
      case 'odd':
        setPageRange(Array.from({ length: state.numPages }, (_, i) => i + 1)
          .filter(p => p % 2 === 1).join(', '));
        break;
      case 'even':
        setPageRange(Array.from({ length: state.numPages }, (_, i) => i + 1)
          .filter(p => p % 2 === 0).join(', '));
        break;
      case 'first':
        setPageRange('1');
        break;
      case 'last':
        setPageRange(String(state.numPages));
        break;
      case 'current':
        setPageRange(String(state.currentPage));
        break;
    }
  }, [state.numPages, state.currentPage]);

  if (!isOpen) return null;

  const parsedPages = parsePageRange(pageRange);

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Extract Pages</h2>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>
        <div className="dialog-content">
          <p className="dialog-description">
            Extract specific pages from your PDF. The extracted pages will be saved as a new PDF file.
          </p>

          <div className="form-group">
            <label htmlFor="pageRange">Pages to extract:</label>
            <input
              id="pageRange"
              type="text"
              className="dialog-input"
              placeholder="e.g., 1, 3-5, 8"
              value={pageRange}
              onChange={(e) => {
                setPageRange(e.target.value);
                setError(null);
              }}
            />
            <span className="form-hint">
              Enter page numbers or ranges (1-{state.numPages})
            </span>
          </div>

          <div className="quick-select">
            <span className="quick-select-label">Quick select:</span>
            <button className="quick-btn" onClick={() => handleQuickSelect('current')}>Current page</button>
            <button className="quick-btn" onClick={() => handleQuickSelect('odd')}>Odd pages</button>
            <button className="quick-btn" onClick={() => handleQuickSelect('even')}>Even pages</button>
            <button className="quick-btn" onClick={() => handleQuickSelect('first')}>First page</button>
            <button className="quick-btn" onClick={() => handleQuickSelect('last')}>Last page</button>
          </div>

          {parsedPages.length > 0 && (
            <div className="preview-info">
              <strong>{parsedPages.length}</strong> page{parsedPages.length !== 1 ? 's' : ''} will be extracted:
              <span className="preview-pages">
                {parsedPages.length <= 10
                  ? parsedPages.join(', ')
                  : `${parsedPages.slice(0, 5).join(', ')}...${parsedPages.slice(-2).join(', ')}`}
              </span>
            </div>
          )}

          {error && <div className="dialog-error">{error}</div>}
        </div>
        <div className="dialog-footer">
          <button className="dialog-btn secondary" onClick={onClose}>Cancel</button>
          <button
            className="dialog-btn primary"
            onClick={handleExtract}
            disabled={isExtracting || parsedPages.length === 0}
          >
            {isExtracting ? 'Extracting...' : 'Extract Pages'}
          </button>
        </div>
      </div>
    </div>
  );
}

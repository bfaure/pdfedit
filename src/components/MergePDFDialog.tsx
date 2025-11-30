import { useState, useCallback, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { usePDF } from '../contexts/PDFContext';
import './DialogStyles.css';
import './MergePDFDialog.css';

interface MergePDFDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PendingFile {
  file: File;
  pageCount: number;
}

export function MergePDFDialog({ isOpen, onClose }: MergePDFDialogProps) {
  const { state, loadFile } = usePDF();
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [insertPosition, setInsertPosition] = useState<'beginning' | 'end'>('end');
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    const newPendingFiles: PendingFile[] = [];

    for (const file of Array.from(files)) {
      if (file.type !== 'application/pdf') {
        setError('Please select only PDF files');
        continue;
      }

      try {
        const bytes = await file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        newPendingFiles.push({
          file,
          pageCount: pdf.getPageCount(),
        });
      } catch (err) {
        setError(`Failed to load ${file.name}: Invalid PDF file`);
      }
    }

    setPendingFiles(prev => [...prev, ...newPendingFiles]);

    // Reset input
    if (e.target) e.target.value = '';
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleMoveFile = useCallback((index: number, direction: 'up' | 'down') => {
    setPendingFiles(prev => {
      const newFiles = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newFiles.length) return prev;
      [newFiles[index], newFiles[targetIndex]] = [newFiles[targetIndex], newFiles[index]];
      return newFiles;
    });
  }, []);

  const handleMerge = useCallback(async () => {
    if (pendingFiles.length === 0) {
      setError('Please select at least one PDF file to merge');
      return;
    }

    setIsMerging(true);
    setError(null);

    try {
      const mergedPdf = await PDFDocument.create();

      // If inserting at beginning, first add new files then existing document
      if (insertPosition === 'beginning') {
        // Add pages from pending files
        for (const { file } of pendingFiles) {
          const bytes = await file.arrayBuffer();
          const pdf = await PDFDocument.load(bytes);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach(page => mergedPdf.addPage(page));
        }

        // Add pages from current document (if one is open)
        if (state.file) {
          const currentBytes = await state.file.arrayBuffer();
          const currentPdf = await PDFDocument.load(currentBytes);
          const currentPages = await mergedPdf.copyPages(currentPdf, currentPdf.getPageIndices());
          currentPages.forEach(page => mergedPdf.addPage(page));
        }
      } else {
        // Add pages from current document first (if one is open)
        if (state.file) {
          const currentBytes = await state.file.arrayBuffer();
          const currentPdf = await PDFDocument.load(currentBytes);
          const currentPages = await mergedPdf.copyPages(currentPdf, currentPdf.getPageIndices());
          currentPages.forEach(page => mergedPdf.addPage(page));
        }

        // Then add pages from pending files
        for (const { file } of pendingFiles) {
          const bytes = await file.arrayBuffer();
          const pdf = await PDFDocument.load(bytes);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach(page => mergedPdf.addPage(page));
        }
      }

      // Save the merged PDF
      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });

      // Create a File object from the blob
      const mergedFileName = state.file
        ? state.fileName.replace(/\.pdf$/i, '_merged.pdf')
        : pendingFiles.length === 1
          ? pendingFiles[0].file.name
          : 'merged.pdf';

      const mergedFile = new File([blob], mergedFileName, { type: 'application/pdf' });

      // Load the merged file as the current document
      await loadFile(mergedFile);

      // Reset and close
      setPendingFiles([]);
      setInsertPosition('end');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge PDFs');
    } finally {
      setIsMerging(false);
    }
  }, [pendingFiles, insertPosition, state.file, state.fileName, loadFile, onClose]);

  const handleClose = useCallback(() => {
    setPendingFiles([]);
    setInsertPosition('end');
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const totalNewPages = pendingFiles.reduce((sum, f) => sum + f.pageCount, 0);
  const hasCurrentDocument = !!state.file;

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog merge-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Merge PDFs</h2>
          <button className="dialog-close" onClick={handleClose}>×</button>
        </div>
        <div className="dialog-content">
          <p className="dialog-description">
            {hasCurrentDocument
              ? 'Add pages from other PDF files to your current document.'
              : 'Select PDF files to combine into a single document.'}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          <button
            className="add-files-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            Add PDF Files
          </button>

          {pendingFiles.length > 0 && (
            <>
              <div className="pending-files-list">
                <div className="files-header">
                  <span>Files to merge ({pendingFiles.length})</span>
                  <span className="pages-total">{totalNewPages} pages</span>
                </div>
                {pendingFiles.map((pf, index) => (
                  <div key={index} className="pending-file-item">
                    <div className="file-info">
                      <span className="file-name" title={pf.file.name}>{pf.file.name}</span>
                      <span className="file-pages">{pf.pageCount} pages</span>
                    </div>
                    <div className="file-actions">
                      <button
                        className="file-action-btn"
                        onClick={() => handleMoveFile(index, 'up')}
                        disabled={index === 0}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        className="file-action-btn"
                        onClick={() => handleMoveFile(index, 'down')}
                        disabled={index === pendingFiles.length - 1}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        className="file-action-btn remove"
                        onClick={() => handleRemoveFile(index)}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {hasCurrentDocument && (
                <div className="form-group">
                  <label>Insert position:</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="insertPosition"
                        value="end"
                        checked={insertPosition === 'end'}
                        onChange={() => setInsertPosition('end')}
                      />
                      <span>At the end</span>
                      <span className="radio-hint">Add new pages after existing pages</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="insertPosition"
                        value="beginning"
                        checked={insertPosition === 'beginning'}
                        onChange={() => setInsertPosition('beginning')}
                      />
                      <span>At the beginning</span>
                      <span className="radio-hint">Add new pages before existing pages</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="merge-summary">
                <strong>Result:</strong>
                {hasCurrentDocument ? (
                  <span>
                    {insertPosition === 'beginning'
                      ? `${totalNewPages} new pages + ${state.numPages} existing pages`
                      : `${state.numPages} existing pages + ${totalNewPages} new pages`
                    } = {state.numPages + totalNewPages} total pages
                  </span>
                ) : (
                  <span>{totalNewPages} pages total</span>
                )}
              </div>
            </>
          )}

          {error && <div className="dialog-error">{error}</div>}
        </div>
        <div className="dialog-footer">
          <button className="dialog-btn secondary" onClick={handleClose}>Cancel</button>
          <button
            className="dialog-btn primary"
            onClick={handleMerge}
            disabled={isMerging || pendingFiles.length === 0}
          >
            {isMerging ? 'Merging...' : 'Merge PDFs'}
          </button>
        </div>
      </div>
    </div>
  );
}

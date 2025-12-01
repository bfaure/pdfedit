import { useState, useEffect, useCallback } from 'react';
import { usePDF } from '../contexts/PDFContext';
import './MetadataPanel.css';

interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modDate?: string;
  [key: string]: string | undefined;
}

interface MetadataPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MetadataPanel({ isOpen, onClose }: MetadataPanelProps) {
  const { pdfDocument, state, setMetadataSanitized } = usePDF();
  const [metadata, setMetadata] = useState<PDFMetadata | null>(null);
  const [customMetadata, setCustomMetadata] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmSanitize, setShowConfirmSanitize] = useState(false);

  // Load metadata when panel opens
  useEffect(() => {
    if (!isOpen || !pdfDocument) {
      setMetadata(null);
      setCustomMetadata({});
      return;
    }

    const loadMetadata = async () => {
      setIsLoading(true);
      try {
        const meta = await pdfDocument.getMetadata();

        // Standard metadata fields
        const info = meta.info as Record<string, unknown>;
        const standardMetadata: PDFMetadata = {};

        // Map standard fields
        const standardFields = [
          'Title', 'Author', 'Subject', 'Keywords',
          'Creator', 'Producer', 'CreationDate', 'ModDate'
        ];

        const fieldMapping: Record<string, string> = {
          'Title': 'title',
          'Author': 'author',
          'Subject': 'subject',
          'Keywords': 'keywords',
          'Creator': 'creator',
          'Producer': 'producer',
          'CreationDate': 'creationDate',
          'ModDate': 'modDate',
        };

        for (const field of standardFields) {
          if (info[field]) {
            const mappedField = fieldMapping[field];
            let value = info[field];

            // Format dates
            if (field === 'CreationDate' || field === 'ModDate') {
              value = formatPDFDate(value as string);
            }

            standardMetadata[mappedField] = String(value);
          }
        }

        setMetadata(standardMetadata);

        // Custom metadata (non-standard fields)
        const custom: Record<string, string> = {};
        for (const [key, value] of Object.entries(info)) {
          if (!standardFields.includes(key) && value && typeof value === 'string') {
            custom[key] = value;
          }
        }
        setCustomMetadata(custom);

      } catch (error) {
        console.error('Failed to load metadata:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetadata();
  }, [isOpen, pdfDocument]);

  const handleSanitize = useCallback(() => {
    setShowConfirmSanitize(false);
    setMetadataSanitized(true);
  }, [setMetadataSanitized]);

  const handleUnsanitize = useCallback(() => {
    setMetadataSanitized(false);
  }, [setMetadataSanitized]);

  if (!isOpen) return null;

  const hasMetadata = metadata && (
    Object.values(metadata).some(v => v) ||
    Object.keys(customMetadata).length > 0
  );

  return (
    <div className="metadata-panel-overlay" onClick={onClose}>
      <div className="metadata-panel" onClick={(e) => e.stopPropagation()}>
        <div className="metadata-header">
          <h2>PDF Metadata</h2>
          <button className="metadata-close" onClick={onClose}>×</button>
        </div>

        <div className="metadata-content">
          {isLoading ? (
            <div className="metadata-loading">Loading metadata...</div>
          ) : !pdfDocument ? (
            <div className="metadata-empty">No PDF loaded</div>
          ) : state.metadataSanitized ? (
            <>
              <div className="metadata-sanitized-notice">
                <div className="metadata-sanitized-icon">✓</div>
                <h3>Metadata Marked for Removal</h3>
                <p>
                  All metadata will be stripped when you save the PDF.
                  The exported file will not contain author names, creation dates,
                  software information, or other identifying metadata.
                </p>
              </div>
              <div className="metadata-file-info">
                <div className="metadata-row">
                  <span className="metadata-label">File Name:</span>
                  <span className="metadata-value">{state.fileName || 'Unknown'}</span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">Pages:</span>
                  <span className="metadata-value">{state.numPages}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="metadata-file-info">
                <div className="metadata-row">
                  <span className="metadata-label">File Name:</span>
                  <span className="metadata-value">{state.fileName || 'Unknown'}</span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">Pages:</span>
                  <span className="metadata-value">{state.numPages}</span>
                </div>
              </div>

              <div className="metadata-section">
                <h3>Document Information</h3>
                {metadata?.title && (
                  <div className="metadata-row">
                    <span className="metadata-label">Title:</span>
                    <span className="metadata-value">{metadata.title}</span>
                  </div>
                )}
                {metadata?.author && (
                  <div className="metadata-row">
                    <span className="metadata-label">Author:</span>
                    <span className="metadata-value">{metadata.author}</span>
                  </div>
                )}
                {metadata?.subject && (
                  <div className="metadata-row">
                    <span className="metadata-label">Subject:</span>
                    <span className="metadata-value">{metadata.subject}</span>
                  </div>
                )}
                {metadata?.keywords && (
                  <div className="metadata-row">
                    <span className="metadata-label">Keywords:</span>
                    <span className="metadata-value">{metadata.keywords}</span>
                  </div>
                )}
                {!metadata?.title && !metadata?.author && !metadata?.subject && !metadata?.keywords && (
                  <div className="metadata-empty-section">No document information</div>
                )}
              </div>

              <div className="metadata-section">
                <h3>Application Information</h3>
                {metadata?.creator && (
                  <div className="metadata-row">
                    <span className="metadata-label">Created With:</span>
                    <span className="metadata-value">{metadata.creator}</span>
                  </div>
                )}
                {metadata?.producer && (
                  <div className="metadata-row">
                    <span className="metadata-label">PDF Producer:</span>
                    <span className="metadata-value">{metadata.producer}</span>
                  </div>
                )}
                {!metadata?.creator && !metadata?.producer && (
                  <div className="metadata-empty-section">No application information</div>
                )}
              </div>

              <div className="metadata-section">
                <h3>Dates</h3>
                {metadata?.creationDate && (
                  <div className="metadata-row">
                    <span className="metadata-label">Created:</span>
                    <span className="metadata-value">{metadata.creationDate}</span>
                  </div>
                )}
                {metadata?.modDate && (
                  <div className="metadata-row">
                    <span className="metadata-label">Modified:</span>
                    <span className="metadata-value">{metadata.modDate}</span>
                  </div>
                )}
                {!metadata?.creationDate && !metadata?.modDate && (
                  <div className="metadata-empty-section">No date information</div>
                )}
              </div>

              {Object.keys(customMetadata).length > 0 && (
                <div className="metadata-section">
                  <h3>Custom Metadata</h3>
                  {Object.entries(customMetadata).map(([key, value]) => (
                    <div className="metadata-row" key={key}>
                      <span className="metadata-label">{key}:</span>
                      <span className="metadata-value">{value}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="metadata-section metadata-privacy">
                <h3>Privacy Notice</h3>
                <p className="metadata-warning">
                  {hasMetadata ? (
                    <>
                      This PDF contains metadata that may reveal personal information
                      such as author names, creation software, and timestamps.
                      Consider sanitizing before sharing publicly.
                    </>
                  ) : (
                    <>
                      This PDF appears to have minimal metadata. However, there may still
                      be hidden information embedded in the document structure.
                    </>
                  )}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="metadata-footer">
          {state.metadataSanitized ? (
            <>
              <button
                className="metadata-btn metadata-btn-secondary"
                onClick={onClose}
              >
                Close
              </button>
              <button
                className="metadata-btn metadata-btn-warning"
                onClick={handleUnsanitize}
              >
                Restore Metadata
              </button>
            </>
          ) : showConfirmSanitize ? (
            <div className="metadata-confirm">
              <span>Strip all metadata when saving?</span>
              <div className="metadata-confirm-buttons">
                <button
                  className="metadata-btn metadata-btn-cancel"
                  onClick={() => setShowConfirmSanitize(false)}
                >
                  Cancel
                </button>
                <button
                  className="metadata-btn metadata-btn-danger"
                  onClick={handleSanitize}
                >
                  Strip Metadata
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                className="metadata-btn metadata-btn-secondary"
                onClick={onClose}
              >
                Close
              </button>
              <button
                className="metadata-btn metadata-btn-primary"
                onClick={() => setShowConfirmSanitize(true)}
                disabled={!pdfDocument}
              >
                Sanitize PDF
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to format PDF date strings
function formatPDFDate(dateStr: string): string {
  if (!dateStr) return '';

  // PDF dates are in format: D:YYYYMMDDHHmmSSOHH'mm'
  // Example: D:20231215103045+05'30'
  try {
    // Remove the D: prefix if present
    let cleaned = dateStr.replace(/^D:/, '');

    // Extract components
    const year = cleaned.substring(0, 4);
    const month = cleaned.substring(4, 6);
    const day = cleaned.substring(6, 8);
    const hour = cleaned.substring(8, 10) || '00';
    const minute = cleaned.substring(10, 12) || '00';
    const second = cleaned.substring(12, 14) || '00';

    // Create date object
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );

    if (isNaN(date.getTime())) {
      return dateStr; // Return original if parsing fails
    }

    return date.toLocaleString();
  } catch {
    return dateStr; // Return original if parsing fails
  }
}

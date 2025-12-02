import { useState, useEffect, useCallback } from 'react';
import { usePDF } from '../contexts/PDFContext';
import type { MetadataOverrides } from '../types/pdf';
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
}

interface EmbeddedScript {
  trigger: string;
  code: string;
}

interface MetadataPanelProps {
  isOpen: boolean;
  onClose: () => void;
  highlightConcerns?: boolean;
}

type MetadataFieldKey = 'title' | 'author' | 'subject' | 'keywords' | 'creator' | 'producer';

const METADATA_FIELDS: { key: MetadataFieldKey; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'author', label: 'Author' },
  { key: 'subject', label: 'Subject' },
  { key: 'keywords', label: 'Keywords' },
  { key: 'creator', label: 'Created With' },
  { key: 'producer', label: 'PDF Producer' },
];

// Known software patterns that are NOT privacy concerns
const KNOWN_SOFTWARE_PATTERNS = [
  /pdf-lib/i, /adobe/i, /acrobat/i, /microsoft/i, /word/i, /excel/i,
  /powerpoint/i, /libreoffice/i, /openoffice/i, /chrome/i, /chromium/i,
  /firefox/i, /safari/i, /webkit/i, /macos/i, /windows/i, /quartz/i,
  /preview/i, /pdftex/i, /latex/i, /ghostscript/i, /pdfcreator/i,
  /nitro/i, /foxit/i, /itext/i, /google\s*docs/i, /tcpdf/i, /fpdf/i,
  /wkhtmltopdf/i, /prince/i, /weasyprint/i, /reportlab/i, /pypdf/i,
  /pdfkit/i, /puppeteer/i, /playwright/i, /dompdf/i, /mpdf/i, /prawn/i,
  /pdfmake/i, /jspdf/i, /pdfsharp/i, /docx/i, /pages/i, /keynote/i,
  /numbers/i, /skia/i, /cairo/i, /poppler/i, /mupdf/i, /xpdf/i,
  /pdfsam/i, /smallpdf/i, /sejda/i, /scanner/i, /xerox/i, /canon/i,
  /epson/i, /hp\s/i, /hewlett/i, /brother/i,
];

function isKnownSoftware(value: string): boolean {
  return KNOWN_SOFTWARE_PATTERNS.some(pattern => pattern.test(value));
}

// Determine if a field should be flagged as a privacy concern
function isPrivacyConcern(key: MetadataFieldKey, value: string | undefined): boolean {
  if (!value || !value.trim()) return false;

  // Author is always sensitive (could be a person's name)
  if (key === 'author') return true;

  // Creator and Producer are only sensitive if they don't match known software
  if (key === 'creator' || key === 'producer') {
    return !isKnownSoftware(value);
  }

  // Title, Subject, Keywords are never flagged
  return false;
}

export function MetadataPanel({ isOpen, onClose, highlightConcerns = false }: MetadataPanelProps) {
  const { pdfDocument, state, setMetadataOverrides } = usePDF();
  const [originalMetadata, setOriginalMetadata] = useState<PDFMetadata>({});
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [embeddedScripts, setEmbeddedScripts] = useState<EmbeddedScript[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedScripts, setExpandedScripts] = useState<Set<number>>(new Set());
  const [showStripConfirm, setShowStripConfirm] = useState(false);

  // Load metadata when panel opens
  useEffect(() => {
    if (!isOpen || !pdfDocument) {
      setOriginalMetadata({});
      setEditedValues({});
      setEmbeddedScripts([]);
      setExpandedScripts(new Set());
      return;
    }

    const loadMetadata = async () => {
      setIsLoading(true);
      try {
        const meta = await pdfDocument.getMetadata();
        const info = meta.info as Record<string, unknown>;

        const metadata: PDFMetadata = {};
        const fieldMapping: Record<string, keyof PDFMetadata> = {
          'Title': 'title',
          'Author': 'author',
          'Subject': 'subject',
          'Keywords': 'keywords',
          'Creator': 'creator',
          'Producer': 'producer',
          'CreationDate': 'creationDate',
          'ModDate': 'modDate',
        };

        for (const [pdfKey, stateKey] of Object.entries(fieldMapping)) {
          if (info[pdfKey]) {
            let value = info[pdfKey];
            if (pdfKey === 'CreationDate' || pdfKey === 'ModDate') {
              value = formatPDFDate(value as string);
            }
            (metadata as Record<string, string>)[stateKey] = String(value);
          }
        }

        setOriginalMetadata(metadata);

        // Initialize edited values from overrides or original
        const edited: Record<string, string> = {};
        for (const field of METADATA_FIELDS) {
          const override = state.metadataOverrides[field.key];
          if (override === null) {
            edited[field.key] = ''; // Marked for removal
          } else if (override !== undefined) {
            edited[field.key] = override;
          } else if (metadata[field.key]) {
            edited[field.key] = metadata[field.key] || '';
          } else {
            edited[field.key] = '';
          }
        }
        setEditedValues(edited);

        // Load embedded JavaScript
        const scripts: EmbeddedScript[] = [];
        try {
          const jsActions = await pdfDocument.getJSActions();
          if (jsActions) {
            for (const [trigger, codeArray] of Object.entries(jsActions)) {
              if (Array.isArray(codeArray)) {
                for (const code of codeArray) {
                  if (code && typeof code === 'string') {
                    scripts.push({ trigger, code });
                  }
                }
              }
            }
          }

          const openAction = await pdfDocument.getOpenAction();
          if (openAction && 'js' in openAction) {
            scripts.push({ trigger: 'OpenAction', code: openAction.js as string });
          }
        } catch (jsError) {
          console.error('Failed to load JavaScript actions:', jsError);
        }

        setEmbeddedScripts(scripts);
      } catch (error) {
        console.error('Failed to load metadata:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetadata();
  }, [isOpen, pdfDocument, state.metadataOverrides]);

  const handleFieldChange = useCallback((field: MetadataFieldKey, value: string) => {
    setEditedValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleRemoveField = useCallback((field: MetadataFieldKey) => {
    setEditedValues(prev => ({ ...prev, [field]: '' }));
    // Mark as removed in overrides
    const newOverrides: MetadataOverrides = { ...state.metadataOverrides, [field]: null };
    setMetadataOverrides(newOverrides);
  }, [state.metadataOverrides, setMetadataOverrides]);

  const handleRestoreField = useCallback((field: MetadataFieldKey) => {
    const originalValue = originalMetadata[field] || '';
    setEditedValues(prev => ({ ...prev, [field]: originalValue }));
    // Remove override
    const newOverrides = { ...state.metadataOverrides };
    delete newOverrides[field];
    setMetadataOverrides(newOverrides);
  }, [originalMetadata, state.metadataOverrides, setMetadataOverrides]);

  const handleSaveField = useCallback((field: MetadataFieldKey) => {
    const newValue = editedValues[field];
    const originalValue = originalMetadata[field] || '';

    if (newValue === originalValue) {
      // No change, remove any override
      const newOverrides = { ...state.metadataOverrides };
      delete newOverrides[field];
      setMetadataOverrides(newOverrides);
    } else if (newValue === '') {
      // Marked for removal
      const newOverrides: MetadataOverrides = { ...state.metadataOverrides, [field]: null };
      setMetadataOverrides(newOverrides);
    } else {
      // Custom value
      const newOverrides: MetadataOverrides = { ...state.metadataOverrides, [field]: newValue };
      setMetadataOverrides(newOverrides);
    }
  }, [editedValues, originalMetadata, state.metadataOverrides, setMetadataOverrides]);

  const handleStripAll = useCallback(() => {
    const newOverrides: MetadataOverrides = { stripAll: true };
    setMetadataOverrides(newOverrides);
    setShowStripConfirm(false);
    // Clear all edited values
    const cleared: Record<string, string> = {};
    for (const field of METADATA_FIELDS) {
      cleared[field.key] = '';
    }
    setEditedValues(cleared);
  }, [setMetadataOverrides]);

  const handleRestoreAll = useCallback(() => {
    setMetadataOverrides({});
    // Restore all original values
    const restored: Record<string, string> = {};
    for (const field of METADATA_FIELDS) {
      restored[field.key] = originalMetadata[field.key] || '';
    }
    setEditedValues(restored);
  }, [originalMetadata, setMetadataOverrides]);

  const toggleScriptExpanded = useCallback((index: number) => {
    setExpandedScripts(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  if (!isOpen) return null;

  const isFieldRemoved = (field: MetadataFieldKey) =>
    state.metadataOverrides.stripAll || state.metadataOverrides[field] === null;

  const isFieldModified = (field: MetadataFieldKey) => {
    if (state.metadataOverrides.stripAll) return true;
    const override = state.metadataOverrides[field];
    return override !== undefined;
  };

  const hasAnyChanges = Object.keys(state.metadataOverrides).length > 0;

  return (
    <div className="metadata-panel-overlay" onClick={onClose}>
      <div className="metadata-panel metadata-panel-wide" onClick={(e) => e.stopPropagation()}>
        <div className="metadata-header">
          <h2>Document Metadata</h2>
          <button className="metadata-close" onClick={onClose}>×</button>
        </div>

        <div className="metadata-content">
          {isLoading ? (
            <div className="metadata-loading">Loading metadata...</div>
          ) : !pdfDocument ? (
            <div className="metadata-empty">No PDF loaded</div>
          ) : (
            <>
              {/* Embedded Scripts Warning - Show FIRST if scripts exist */}
              {embeddedScripts.length > 0 && (
                <div className="metadata-section metadata-scripts">
                  <h3>
                    Embedded Scripts
                    <span className="script-warning-badge">{embeddedScripts.length} found</span>
                  </h3>
                  <div className={`script-warning ${highlightConcerns ? 'highlight-concern' : ''}`}>
                    <span className="warning-icon">⚠</span>
                    <span>
                      This PDF contains embedded JavaScript. While it won't execute on this site,
                      it could run in other PDF readers.
                    </span>
                  </div>
                  {embeddedScripts.map((script, index) => (
                    <div key={index} className="embedded-script">
                      <button
                        className="script-header"
                        onClick={() => toggleScriptExpanded(index)}
                      >
                        <span className="script-trigger">
                          {script.trigger === 'Doc' ? 'Document Level' :
                           script.trigger === 'OpenAction' ? 'On Document Open' :
                           script.trigger}
                        </span>
                        <span className="script-toggle">
                          {expandedScripts.has(index) ? '▼' : '▶'}
                        </span>
                      </button>
                      {expandedScripts.has(index) && (
                        <pre className="script-code">{script.code}</pre>
                      )}
                    </div>
                  ))}
                  <p className="script-note">
                    Note: Embedded scripts cannot be removed from the PDF.
                  </p>
                </div>
              )}

              {/* Strip All Banner */}
              {state.metadataOverrides.stripAll && (
                <div className="metadata-strip-banner">
                  <span className="strip-icon">🛡️</span>
                  <div className="strip-text">
                    <strong>All metadata will be stripped</strong>
                    <p>When you save the PDF, all metadata fields will be removed.</p>
                  </div>
                  <button className="metadata-btn metadata-btn-small" onClick={handleRestoreAll}>
                    Restore All
                  </button>
                </div>
              )}

              {/* Editable Metadata Fields */}
              <div className="metadata-section">
                <h3>Metadata</h3>
                <div className="metadata-fields-grid">
                  {METADATA_FIELDS.map((field) => {
                    const removed = isFieldRemoved(field.key);
                    const modified = isFieldModified(field.key);
                    const shouldHighlight = highlightConcerns && isPrivacyConcern(field.key, originalMetadata[field.key]);

                    return (
                      <div
                        key={field.key}
                        className={`metadata-field ${removed ? 'removed' : ''} ${modified ? 'modified' : ''} ${shouldHighlight ? 'highlight-concern' : ''}`}
                      >
                        <label className="field-label">
                          {field.label}
                          {shouldHighlight && <span className="concern-badge">Privacy</span>}
                        </label>
                        <div className="field-input-row">
                          <input
                            type="text"
                            className="field-input"
                            value={editedValues[field.key] || ''}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            onBlur={() => handleSaveField(field.key)}
                            placeholder={removed ? '(removed)' : '(empty)'}
                            disabled={state.metadataOverrides.stripAll}
                          />
                          <div className="field-actions">
                            {removed ? (
                              <button
                                className="field-btn restore"
                                onClick={() => handleRestoreField(field.key)}
                                title="Restore original value"
                                disabled={state.metadataOverrides.stripAll}
                              >
                                ↺
                              </button>
                            ) : (
                              <button
                                className="field-btn remove"
                                onClick={() => handleRemoveField(field.key)}
                                title="Remove this field"
                                disabled={state.metadataOverrides.stripAll}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                        {originalMetadata[field.key] && !removed && editedValues[field.key] !== originalMetadata[field.key] && (
                          <div className="field-original">
                            Original: {originalMetadata[field.key]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Document Info - Compact footer */}
              <div className="metadata-info-footer">
                <span className="info-item">
                  <strong>{state.numPages}</strong> pages
                </span>
                {originalMetadata.creationDate && !state.metadataOverrides.stripAll && (
                  <span className="info-item">
                    Created: {originalMetadata.creationDate}
                  </span>
                )}
                {originalMetadata.modDate && !state.metadataOverrides.stripAll && (
                  <span className="info-item">
                    Modified: {originalMetadata.modDate}
                  </span>
                )}
                {embeddedScripts.length === 0 && (
                  <span className="info-item info-safe">✓ No scripts</span>
                )}
              </div>
            </>
          )}
        </div>

        <div className="metadata-footer">
          {showStripConfirm ? (
            <div className="metadata-confirm">
              <span>Remove all metadata when saving?</span>
              <div className="metadata-confirm-buttons">
                <button
                  className="metadata-btn metadata-btn-cancel"
                  onClick={() => setShowStripConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="metadata-btn metadata-btn-danger"
                  onClick={handleStripAll}
                >
                  Strip All
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="footer-left">
                {hasAnyChanges && (
                  <button
                    className="metadata-btn metadata-btn-secondary"
                    onClick={handleRestoreAll}
                  >
                    Reset Changes
                  </button>
                )}
              </div>
              <div className="footer-right">
                <button
                  className="metadata-btn metadata-btn-secondary"
                  onClick={onClose}
                >
                  Close
                </button>
                {!state.metadataOverrides.stripAll && (
                  <button
                    className="metadata-btn metadata-btn-danger"
                    onClick={() => setShowStripConfirm(true)}
                    disabled={!pdfDocument}
                  >
                    Strip All Metadata
                  </button>
                )}
              </div>
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

  try {
    let cleaned = dateStr.replace(/^D:/, '');
    const year = cleaned.substring(0, 4);
    const month = cleaned.substring(4, 6);
    const day = cleaned.substring(6, 8);
    const hour = cleaned.substring(8, 10) || '00';
    const minute = cleaned.substring(10, 12) || '00';
    const second = cleaned.substring(12, 14) || '00';

    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );

    if (isNaN(date.getTime())) {
      return dateStr;
    }

    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}

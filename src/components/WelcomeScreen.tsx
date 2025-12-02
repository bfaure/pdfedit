import { useRef, useState } from 'react';
import { usePDF } from '../contexts/PDFContext';
import './WelcomeScreen.css';

interface Feature {
  icon: string;
  title: string;
  desc: string;
  details: {
    description: string;
    steps: string[];
    tips?: string[];
  };
}

interface WelcomeScreenProps {
  onShowPrivacy?: () => void;
  onShowTerms?: () => void;
}

export function WelcomeScreen({ onShowPrivacy, onShowTerms }: WelcomeScreenProps) {
  const { loadFile } = usePDF();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await loadFile(file);
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const features: Feature[] = [
    {
      icon: '📄',
      title: 'View & Navigate',
      desc: 'Scroll through pages, zoom, rotate, and search text',
      details: {
        description: 'Browse your PDF documents with smooth scrolling, precise zoom controls, and powerful text search.',
        steps: [
          'Use the scroll wheel or drag to navigate through pages',
          'Click the + and - buttons in the toolbar to zoom, or use Ctrl + scroll',
          'Press Ctrl+F to search for text within the document',
          'Use the rotation buttons to rotate pages as needed',
        ],
        tips: [
          'Press arrow keys to move between pages quickly',
          'Double-click to zoom in on a specific area',
        ],
      },
    },
    {
      icon: '✏️',
      title: 'Annotate',
      desc: 'Highlight text, draw, add shapes and text notes',
      details: {
        description: 'Mark up your documents with highlights, freehand drawings, shapes, and text annotations.',
        steps: [
          'Select the Highlight tool (M) and drag over text to highlight it',
          'Use the Draw tool (P) for freehand annotations',
          'Add rectangles, circles, or arrows using the shape tools',
          'Click the Text tool (T) to add text notes anywhere on the page',
        ],
        tips: [
          'Use the Eraser tool to remove annotations',
          'All annotations are saved when you export the PDF',
        ],
      },
    },
    {
      icon: '✍️',
      title: 'Sign Documents',
      desc: 'Draw your signature directly on any page',
      details: {
        description: 'Add your handwritten signature to contracts, forms, and other documents that need signing.',
        steps: [
          'Click the Signature tool in the toolbar',
          'Draw your signature in the signature pad that appears',
          'Click "Add Signature" to place it on the document',
          'Drag to position and resize your signature as needed',
        ],
        tips: [
          'Draw slowly for a smoother signature',
          'You can add multiple signatures to a single document',
        ],
      },
    },
    {
      icon: '📑',
      title: 'Edit Pages',
      desc: 'Delete, rotate, reorder, and extract pages',
      details: {
        description: 'Reorganize your PDF by removing unwanted pages, changing page order, or extracting specific pages.',
        steps: [
          'Use the thumbnail sidebar to see all pages at a glance',
          'Drag and drop thumbnails to reorder pages',
          'Right-click a thumbnail or use the Delete button to remove pages',
          'Use File > Extract Pages to save specific pages as a new PDF',
        ],
        tips: [
          'Deleted pages can be restored using Undo (Ctrl+Z)',
          'Rotate individual pages by right-clicking the thumbnail',
        ],
      },
    },
    {
      icon: '🔗',
      title: 'Merge & Split',
      desc: 'Combine multiple PDFs or split into separate files',
      details: {
        description: 'Combine multiple PDF files into one document, or split a large PDF into smaller files.',
        steps: [
          'To merge: Go to File > Merge PDFs and select the files to combine',
          'Arrange the order of files before merging',
          'To split: Go to File > Split PDF and choose where to divide',
          'Each section becomes a separate downloadable PDF',
        ],
        tips: [
          'You can merge PDFs of different page sizes',
          'Use Extract Pages to pull out non-consecutive pages',
        ],
      },
    },
    {
      icon: '💾',
      title: 'Export',
      desc: 'Save your edited PDF with all changes included',
      details: {
        description: 'Download your edited PDF with all annotations, signatures, and page modifications included.',
        steps: [
          'Click File > Save or press Ctrl+S when you\'re done editing',
          'Your browser will download the modified PDF',
          'The original file remains unchanged on your device',
          'Use Print (Ctrl+P) to print directly or save as PDF',
        ],
        tips: [
          'The exported file includes all your annotations embedded',
          'Page deletions and reordering are reflected in the final file',
        ],
      },
    },
  ];

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-header">
          <img
            src="/PDFEdit_Live_StyleGuide/PDFEdit_Horizontal_TPBG.svg"
            alt="PDFEdit.live"
            className="welcome-logo welcome-logo-light"
          />
          <img
            src="/PDFEdit_Live_StyleGuide/PDFEdit_Horizontal_Dark.svg"
            alt="PDFEdit.live"
            className="welcome-logo welcome-logo-dark"
          />
          <p className="welcome-subtitle">
            Edit PDFs securely in your browser. No uploads, no servers — your files never leave your device.
          </p>
        </div>

        <div className="security-banner">
          <div className="security-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <div className="security-text">
            <strong>Your files stay on your device</strong>
            <p>This editor runs completely in your browser. Your PDFs are never uploaded to any server — everything happens right here on your computer, keeping your documents private and secure.</p>
          </div>
        </div>

        <div className="welcome-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            className="welcome-btn primary"
            onClick={openFilePicker}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            Open PDF
          </button>
          <p className="drop-hint">or drag and drop a file anywhere</p>
        </div>

        <div className="features-grid">
          {features.map((feature) => (
            <button
              key={feature.title}
              className="feature-card"
              onClick={() => setSelectedFeature(feature)}
            >
              <span className="feature-icon">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
              <span className="feature-learn-more">Learn more</span>
            </button>
          ))}
        </div>

        <div className="welcome-footer">
          <p className="welcome-footer-shortcuts">Press <kbd>?</kbd> anytime to see keyboard shortcuts</p>
          <div className="welcome-footer-links">
            {onShowPrivacy && (
              <button onClick={onShowPrivacy} className="footer-link">Privacy Policy</button>
            )}
            {onShowTerms && (
              <button onClick={onShowTerms} className="footer-link">Terms of Service</button>
            )}
          </div>
        </div>
      </div>

      {/* Feature Detail Modal */}
      {selectedFeature && (
        <div className="feature-modal-overlay" onClick={() => setSelectedFeature(null)}>
          <div className="feature-modal" onClick={(e) => e.stopPropagation()}>
            <button className="feature-modal-close" onClick={() => setSelectedFeature(null)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            <div className="feature-modal-header">
              <span className="feature-modal-icon">{selectedFeature.icon}</span>
              <h2>{selectedFeature.title}</h2>
            </div>

            <p className="feature-modal-description">{selectedFeature.details.description}</p>

            <div className="feature-modal-section">
              <h3>How to use</h3>
              <ol className="feature-modal-steps">
                {selectedFeature.details.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>

            {selectedFeature.details.tips && (
              <div className="feature-modal-section">
                <h3>Tips</h3>
                <ul className="feature-modal-tips">
                  {selectedFeature.details.tips.map((tip, index) => (
                    <li key={index}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="feature-modal-cta">
              <p className="feature-modal-cta-text">Ready to try it out?</p>
              <button className="welcome-btn primary" onClick={openFilePicker}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                Get Started — Open a PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

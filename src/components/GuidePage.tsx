import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './GuidePage.css';

type TabId = 'guide' | 'faq' | 'shortcuts' | 'privacy-tips';

interface FAQItem {
  question: string;
  answer: string;
}

export function GuidePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('guide');
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'guide', label: 'User Guide' },
    { id: 'faq', label: 'FAQ' },
    { id: 'shortcuts', label: 'Keyboard Shortcuts' },
    { id: 'privacy-tips', label: 'Privacy & Security' },
  ];

  const faqs: FAQItem[] = [
    {
      question: 'Is PDFEdit.live really free?',
      answer: 'Yes, PDFEdit.live is completely free to use. There are no hidden fees, subscriptions, or premium tiers. All features including viewing, editing, annotating, signing, merging, and splitting PDFs are available at no cost. The service is supported by non-intrusive advertising.',
    },
    {
      question: 'Are my PDF files uploaded to a server?',
      answer: 'No. PDFEdit.live processes everything entirely in your web browser using JavaScript. Your PDF files never leave your device. There is no server-side processing, no file uploads, and no cloud storage involved. This means your sensitive documents remain completely private and secure on your own computer.',
    },
    {
      question: 'What happens to my files after I close the browser?',
      answer: 'Since PDFEdit.live does not upload or store your files anywhere, once you close the browser tab, all data related to your editing session is gone. Make sure to save/download your edited PDF before closing the tab. The original file on your device remains untouched.',
    },
    {
      question: 'Can I edit password-protected PDFs?',
      answer: 'PDFEdit.live can open PDFs that have an "owner password" (restricting editing) in most cases, as the browser-based PDF rendering handles this. However, PDFs with a "user password" (requiring a password to open) will need to be unlocked first using the correct password. We do not provide password-cracking capabilities.',
    },
    {
      question: 'What file formats are supported?',
      answer: 'PDFEdit.live works exclusively with PDF files (.pdf). You can open any standard PDF file. For saving, the edited document is always exported as a PDF. If you need to work with other formats like Word (.docx) or images, you will need to convert them to PDF first using another tool.',
    },
    {
      question: 'Can I undo my changes?',
      answer: 'Yes! PDFEdit.live has a full undo/redo system. Press Ctrl+Z (or Cmd+Z on Mac) to undo your last action, and Ctrl+Y (or Cmd+Shift+Z) to redo. You can also view your complete edit history through the Edit > History menu. The history supports up to 50 actions.',
    },
    {
      question: 'How do I add a signature to my PDF?',
      answer: 'Select the Signature tool from the toolbar (or press S), then click where you want to place your signature on the PDF. A signature pad will appear where you can draw your signature with your mouse or touchscreen. Click "Add Signature" to place it. You can then drag to reposition or resize it as needed.',
    },
    {
      question: 'Can I merge multiple PDFs into one?',
      answer: 'Yes. Go to File > Merge PDFs in the menu bar. You can select multiple PDF files, arrange their order by dragging, and then merge them into a single PDF document. The merged file will contain all pages from all selected PDFs in the order you specify.',
    },
    {
      question: 'Can I split a PDF into multiple files?',
      answer: 'Yes. Open your PDF, then go to File > Split PDF. You can specify the page numbers where you want to split the document. Each resulting section will be downloaded as a separate PDF file.',
    },
    {
      question: 'How do I delete pages from a PDF?',
      answer: 'Open the PDF and make sure the thumbnail sidebar is visible (click the sidebar toggle in the toolbar). Right-click on any page thumbnail to see options including "Delete Page". You can also use the page management tools in the sidebar. Deleted pages can be restored using Undo (Ctrl+Z) if needed.',
    },
    {
      question: 'Why does my text look different in the saved PDF?',
      answer: 'PDFEdit.live uses standard PDF fonts (like Helvetica) when embedding text annotations into the final PDF. While the on-screen editing experience supports various web fonts, the exported PDF uses the closest standard font available. For best results, use common fonts like Arial or Times New Roman.',
    },
    {
      question: 'Can I use PDFEdit.live on my phone or tablet?',
      answer: 'Yes! PDFEdit.live is fully responsive and works on mobile devices and tablets. On smaller screens, the toolbar adapts to show the most important tools, and additional options are available through the mobile menu. Touch gestures are supported for drawing and signing.',
    },
    {
      question: 'Is there a file size limit?',
      answer: 'There is no strict file size limit since everything runs in your browser. However, very large PDFs (over 100MB or with hundreds of pages) may be slow to process depending on your device\'s available memory and processing power. For best performance, we recommend PDFs under 50MB.',
    },
    {
      question: 'Does PDFEdit.live work offline?',
      answer: 'Once the page is fully loaded in your browser, the core editing functionality works without an internet connection since all processing is client-side. However, you need an internet connection to initially load the application. We are working on full offline support through a Progressive Web App (PWA) update.',
    },
    {
      question: 'How do I rotate pages?',
      answer: 'You can rotate individual pages by right-clicking on a thumbnail in the sidebar and selecting "Rotate Clockwise" or "Rotate Counter-clockwise". To rotate all pages at once, use the rotation controls in the View menu. Rotations are preserved when you save the PDF.',
    },
    {
      question: 'Can I add images to my PDF?',
      answer: 'Yes. Select the Image tool from the toolbar, then click where you want to place the image on the PDF. A file picker will open allowing you to select an image from your device. The image will be placed at your click location and can be resized and repositioned. Supported formats include PNG, JPEG, and other common image formats.',
    },
    {
      question: 'How do I highlight text in my PDF?',
      answer: 'Select the Highlight tool from the toolbar (or press M), then click and drag over the area you want to highlight. You can choose from multiple highlight colors and adjust the opacity using the tool options that appear in the toolbar. The highlight is saved as an overlay in the final PDF.',
    },
    {
      question: 'Can I search for text in my PDF?',
      answer: 'Yes. Press Ctrl+F (or Cmd+F on Mac) to open the search panel. Type your search term and the tool will find and highlight matching text throughout the document. Use the navigation arrows to jump between matches.',
    },
  ];

  return (
    <div className="guide-page">
      <header className="guide-header">
        <div className="guide-header-inner">
          <button className="guide-back-btn" onClick={() => navigate('/')} title="Back to editor">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            PDFEdit.live
          </button>
          <h1>Help & User Guide</h1>
        </div>
      </header>

      <nav className="guide-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`guide-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="guide-content">
        {activeTab === 'guide' && <UserGuideContent />}
        {activeTab === 'faq' && (
          <FAQContent faqs={faqs} openIndex={openFAQ} onToggle={(i) => setOpenFAQ(openFAQ === i ? null : i)} />
        )}
        {activeTab === 'shortcuts' && <ShortcutsContent />}
        {activeTab === 'privacy-tips' && <PrivacyTipsContent />}
      </main>

      <footer className="guide-footer">
        <p>PDFEdit.live — Free & Private PDF Editor. Your files never leave your device.</p>
        <button className="guide-cta-btn" onClick={() => navigate('/')}>
          Open PDF Editor
        </button>
      </footer>
    </div>
  );
}

function UserGuideContent() {
  return (
    <div className="guide-section">
      <h2>Getting Started with PDFEdit.live</h2>
      <p>
        PDFEdit.live is a powerful, free PDF editor that runs entirely in your web browser. Unlike other online PDF tools,
        your files are never uploaded to any server — all processing happens locally on your device, ensuring complete privacy and security.
      </p>

      <h3>Opening a PDF</h3>
      <p>There are three ways to open a PDF file:</p>
      <ol>
        <li><strong>Click "Open PDF"</strong> on the welcome screen and select a file from your computer.</li>
        <li><strong>Drag and drop</strong> a PDF file anywhere onto the application window.</li>
        <li><strong>Use the File menu</strong> and select "Open" (or press Ctrl+O / Cmd+O).</li>
      </ol>

      <h3>Navigating Your Document</h3>
      <p>Once your PDF is open, you can navigate through it in several ways:</p>
      <ul>
        <li><strong>Scroll</strong> through pages using your mouse wheel or trackpad.</li>
        <li><strong>Page controls</strong> in the toolbar let you jump to specific pages using the page number input.</li>
        <li><strong>Thumbnail sidebar</strong> shows all pages at a glance. Click a thumbnail to jump to that page.</li>
        <li><strong>Keyboard shortcuts:</strong> Use arrow keys or Page Up/Page Down to navigate between pages.</li>
        <li><strong>Zoom:</strong> Use the + and - buttons in the toolbar, or hold Ctrl and scroll to zoom in/out.</li>
      </ul>

      <h3>Adding Text</h3>
      <p>
        The Text tool allows you to add text anywhere on your PDF. Here is how to use it:
      </p>
      <ol>
        <li>Select the <strong>Text tool (T)</strong> from the toolbar.</li>
        <li>Click anywhere on the PDF page where you want to add text.</li>
        <li>A text box will appear with a formatting toolbar above it.</li>
        <li>Type your text. Use the formatting toolbar to change the font, size, color, and background.</li>
        <li>Press <strong>Enter</strong> or click the <strong>checkmark button</strong> to confirm your text.</li>
        <li>Press <strong>Escape</strong> to cancel without adding the text.</li>
        <li>Use <strong>Shift+Enter</strong> for multi-line text within a single text box.</li>
      </ol>
      <p>
        After placing text, switch to the <strong>Select tool</strong> to move, resize, or edit it.
        Double-click any text annotation to re-edit its content.
      </p>

      <h3>Drawing and Annotation Tools</h3>
      <p>PDFEdit.live provides several tools for marking up your documents:</p>
      <ul>
        <li>
          <strong>Highlight tool (M):</strong> Click and drag to highlight areas of the page. Choose from multiple
          colors and adjust the opacity to make highlights more or less transparent.
        </li>
        <li>
          <strong>Draw tool (P):</strong> Freehand drawing with customizable pen color and stroke width. Great for
          circling items, underlining, or adding handwritten notes.
        </li>
        <li>
          <strong>Shape tools:</strong> Add rectangles, circles, and arrows. Click the shapes dropdown in the toolbar
          to select which shape to draw.
        </li>
        <li>
          <strong>Eraser tool:</strong> Click on any annotation to remove it. Only affects annotations you have added,
          not the original PDF content.
        </li>
      </ul>

      <h3>Signing Documents</h3>
      <p>
        Adding a signature is one of the most common tasks when working with PDFs. PDFEdit.live makes it simple:
      </p>
      <ol>
        <li>Select the <strong>Signature tool</strong> from the toolbar.</li>
        <li>Click where you want your signature to appear on the page.</li>
        <li>A signature pad will open where you can draw your signature with your mouse or finger (on touch devices).</li>
        <li>Click "Add Signature" to place it, or "Clear" to start over.</li>
        <li>Once placed, you can drag to reposition and use the resize handles to adjust the size.</li>
      </ol>

      <h3>Adding Images</h3>
      <p>
        You can embed images directly into your PDF pages:
      </p>
      <ol>
        <li>Select the <strong>Image tool</strong> from the toolbar.</li>
        <li>Click where you want the image to appear.</li>
        <li>Select an image file from your device (PNG, JPEG, etc.).</li>
        <li>The image will be placed at your click location. Use the Select tool to move and resize it.</li>
      </ol>

      <h3>Managing Pages</h3>
      <p>PDFEdit.live offers comprehensive page management features:</p>
      <ul>
        <li><strong>Reorder pages:</strong> Drag and drop thumbnails in the sidebar to change page order.</li>
        <li><strong>Delete pages:</strong> Right-click a thumbnail and select "Delete". Use Undo to restore.</li>
        <li><strong>Rotate pages:</strong> Right-click a thumbnail and choose rotation options, or use View menu.</li>
        <li><strong>Extract pages:</strong> Use File &gt; Extract Pages to save specific pages as a new PDF.</li>
      </ul>

      <h3>Merging PDFs</h3>
      <p>To combine multiple PDF files into one document:</p>
      <ol>
        <li>Go to <strong>File &gt; Merge PDFs</strong> in the menu bar.</li>
        <li>Click "Add Files" to select the PDFs you want to merge.</li>
        <li>Drag to reorder the files if needed.</li>
        <li>Click "Merge" to combine them into a single PDF.</li>
      </ol>

      <h3>Splitting PDFs</h3>
      <p>To split a PDF into multiple smaller files:</p>
      <ol>
        <li>Open the PDF you want to split.</li>
        <li>Go to <strong>File &gt; Split PDF</strong>.</li>
        <li>Enter the page numbers where you want to split (e.g., split after page 5 and page 10).</li>
        <li>Click "Split" to download each section as a separate PDF.</li>
      </ol>

      <h3>Saving Your Work</h3>
      <p>
        When you are done editing, save your work using one of these methods:
      </p>
      <ul>
        <li><strong>File &gt; Save</strong> (or Ctrl+S / Cmd+S): Downloads the edited PDF with all your annotations embedded.</li>
        <li><strong>Print</strong> (Ctrl+P / Cmd+P): Opens the browser print dialog where you can also "Save as PDF".</li>
      </ul>
      <p>
        <strong>Important:</strong> Your original file is never modified. The save function creates a new file with "_edited" appended to the filename.
        Always keep your original files as backups.
      </p>

      <h3>Metadata Management</h3>
      <p>
        PDFEdit.live lets you view and edit PDF metadata (title, author, subject, keywords, etc.).
        This is useful for organizing your documents and for removing sensitive information before sharing.
        Access metadata through <strong>File &gt; Properties/Metadata</strong>.
      </p>
    </div>
  );
}

function FAQContent({ faqs, openIndex, onToggle }: { faqs: FAQItem[]; openIndex: number | null; onToggle: (i: number) => void }) {
  return (
    <div className="guide-section">
      <h2>Frequently Asked Questions</h2>
      <p>Find answers to the most common questions about PDFEdit.live below.</p>
      <div className="faq-list">
        {faqs.map((faq, index) => (
          <div key={index} className={`faq-item ${openIndex === index ? 'open' : ''}`}>
            <button className="faq-question" onClick={() => onToggle(index)}>
              <span>{faq.question}</span>
              <svg
                className="faq-chevron"
                width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {openIndex === index && (
              <div className="faq-answer">
                <p>{faq.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShortcutsContent() {
  const shortcutGroups = [
    {
      title: 'File Operations',
      shortcuts: [
        { keys: 'Ctrl + O', action: 'Open a PDF file' },
        { keys: 'Ctrl + S', action: 'Save/export the edited PDF' },
        { keys: 'Ctrl + P', action: 'Print the document' },
      ],
    },
    {
      title: 'Navigation',
      shortcuts: [
        { keys: 'Page Up / Arrow Up', action: 'Go to previous page' },
        { keys: 'Page Down / Arrow Down', action: 'Go to next page' },
        { keys: 'Home', action: 'Go to first page' },
        { keys: 'End', action: 'Go to last page' },
        { keys: 'Ctrl + F', action: 'Open text search' },
      ],
    },
    {
      title: 'Zoom',
      shortcuts: [
        { keys: 'Ctrl + +', action: 'Zoom in' },
        { keys: 'Ctrl + -', action: 'Zoom out' },
        { keys: 'Ctrl + 0', action: 'Reset zoom to 100%' },
        { keys: 'Ctrl + Scroll', action: 'Zoom in/out with mouse wheel' },
      ],
    },
    {
      title: 'Tools',
      shortcuts: [
        { keys: 'V', action: 'Select tool' },
        { keys: 'H', action: 'Pan/Hand tool' },
        { keys: 'T', action: 'Text tool' },
        { keys: 'P', action: 'Pen/Draw tool' },
        { keys: 'M', action: 'Highlight/Marker tool' },
        { keys: 'S', action: 'Signature tool' },
        { keys: 'E', action: 'Eraser tool' },
      ],
    },
    {
      title: 'Editing',
      shortcuts: [
        { keys: 'Ctrl + Z', action: 'Undo last action' },
        { keys: 'Ctrl + Y', action: 'Redo last action' },
        { keys: 'Delete / Backspace', action: 'Delete selected annotation' },
        { keys: 'Escape', action: 'Cancel current operation / deselect' },
      ],
    },
    {
      title: 'Text Editing',
      shortcuts: [
        { keys: 'Enter', action: 'Confirm text input' },
        { keys: 'Shift + Enter', action: 'New line in text box' },
        { keys: 'Escape', action: 'Cancel text input' },
      ],
    },
  ];

  return (
    <div className="guide-section">
      <h2>Keyboard Shortcuts</h2>
      <p>
        PDFEdit.live supports a comprehensive set of keyboard shortcuts to help you work more efficiently.
        On macOS, use Cmd instead of Ctrl for most shortcuts.
      </p>
      {shortcutGroups.map((group) => (
        <div key={group.title} className="shortcuts-group">
          <h3>{group.title}</h3>
          <table className="shortcuts-table">
            <thead>
              <tr>
                <th>Shortcut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {group.shortcuts.map((shortcut) => (
                <tr key={shortcut.keys}>
                  <td><kbd>{shortcut.keys}</kbd></td>
                  <td>{shortcut.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="shortcuts-tip">
        Press <kbd>?</kbd> at any time while using the editor to view keyboard shortcuts in a popup overlay.
      </p>
    </div>
  );
}

function PrivacyTipsContent() {
  return (
    <div className="guide-section">
      <h2>Privacy & Security Guide</h2>
      <p>
        PDFEdit.live was designed from the ground up with privacy as a core principle. Here is everything you need
        to know about how your data is handled and how to get the most security out of the tool.
      </p>

      <h3>How Your Privacy is Protected</h3>
      <ul>
        <li>
          <strong>100% Client-Side Processing:</strong> All PDF operations — viewing, editing, annotating, merging,
          splitting — happen entirely in your web browser using JavaScript. No file data is ever sent to our servers
          or any third-party service.
        </li>
        <li>
          <strong>No File Storage:</strong> We do not store, cache, or log any of your PDF files or their contents.
          Once you close the browser tab, your editing session data is completely gone.
        </li>
        <li>
          <strong>No Account Required:</strong> You do not need to create an account, provide an email address, or
          share any personal information to use PDFEdit.live.
        </li>
        <li>
          <strong>Open Source Transparency:</strong> The source code for PDFEdit.live is available for review,
          so you can verify our privacy claims for yourself.
        </li>
      </ul>

      <h3>PDF Metadata Awareness</h3>
      <p>
        PDF files can contain hidden metadata that may reveal sensitive information, such as:
      </p>
      <ul>
        <li>Author name and email address</li>
        <li>Software used to create the document</li>
        <li>Creation and modification dates</li>
        <li>Company or organization name</li>
        <li>Comments and revision history</li>
      </ul>
      <p>
        PDFEdit.live includes a <strong>Metadata Inspector</strong> (accessible via File &gt; Properties/Metadata)
        that lets you view, edit, or strip metadata from your PDFs before sharing them. This is especially important
        when sharing documents externally or publishing them online.
      </p>

      <h3>Best Practices for Sensitive Documents</h3>
      <ol>
        <li>
          <strong>Check metadata before sharing:</strong> Use the Metadata Inspector to review and remove any
          personally identifiable information from the document properties.
        </li>
        <li>
          <strong>Use the metadata "Strip All" option:</strong> When sharing a document externally, consider stripping
          all metadata to ensure no hidden information is leaked.
        </li>
        <li>
          <strong>Keep original files:</strong> Always maintain a backup of your original, unedited PDF files.
          The editing process creates a new file but mistakes can happen.
        </li>
        <li>
          <strong>Verify before sending:</strong> After editing and saving, open the resulting PDF to verify that
          all changes look correct and no unintended information is visible.
        </li>
        <li>
          <strong>Use HTTPS:</strong> Always access PDFEdit.live through HTTPS (the default) to ensure that the
          application code itself is delivered securely to your browser.
        </li>
      </ol>

      <h3>Technical Architecture</h3>
      <p>
        For the technically inclined, here is how PDFEdit.live works under the hood:
      </p>
      <ul>
        <li>
          <strong>PDF.js</strong> (by Mozilla) is used for rendering and parsing PDF documents in the browser.
          This is the same engine used by Firefox's built-in PDF viewer.
        </li>
        <li>
          <strong>pdf-lib</strong> is used for PDF manipulation (adding annotations, modifying pages, etc.)
          when exporting the final document.
        </li>
        <li>
          <strong>React</strong> powers the user interface, ensuring a smooth and responsive editing experience.
        </li>
        <li>
          All libraries run entirely in the browser's JavaScript engine. No WebAssembly server calls,
          no API endpoints for file processing, and no temporary file storage.
        </li>
      </ul>

      <h3>Cookies and Analytics</h3>
      <p>
        PDFEdit.live uses minimal cookies strictly for:
      </p>
      <ul>
        <li>Serving advertisements through Google AdSense (which uses its own cookies for ad personalization)</li>
        <li>Basic anonymous usage analytics to understand which features are most used</li>
      </ul>
      <p>
        No cookies are used to track your document content, editing activity, or personal information.
        You can opt out of personalized advertising through your browser settings or through
        Google's Ad Settings page.
      </p>
    </div>
  );
}

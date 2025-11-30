import './LegalPages.css';

interface LegalPagesProps {
  page: 'privacy' | 'terms';
  onClose: () => void;
}

export function LegalPages({ page, onClose }: LegalPagesProps) {
  return (
    <div className="legal-modal-overlay" onClick={onClose}>
      <div className="legal-modal" onClick={(e) => e.stopPropagation()}>
        <button className="legal-modal-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div className="legal-content">
          {page === 'privacy' ? <PrivacyPolicy /> : <TermsOfService />}
        </div>
      </div>
    </div>
  );
}

function PrivacyPolicy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

      <section>
        <h2>Overview</h2>
        <p>
          PDFEdit.live ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains
          how we handle information when you use our web-based PDF editing tool.
        </p>
        <p>
          <strong>The key point: Your PDF files are processed entirely in your browser and are never uploaded
          to our servers.</strong>
        </p>
      </section>

      <section>
        <h2>Information We Do NOT Collect</h2>
        <p>We do not collect, store, or have access to:</p>
        <ul>
          <li>Your PDF files or any documents you edit</li>
          <li>The content of your files (text, images, annotations)</li>
          <li>Any signatures you add to documents</li>
          <li>Any personal information contained in your documents</li>
        </ul>
        <p>
          All PDF processing happens locally in your web browser using JavaScript. Your files never leave your device.
        </p>
      </section>

      <section>
        <h2>Information We May Collect</h2>
        <p>Like most websites, we may collect limited information to help us improve the service:</p>
        <ul>
          <li><strong>Usage analytics:</strong> Anonymous data about how the tool is used (e.g., which features are popular), collected via standard analytics tools</li>
          <li><strong>Technical information:</strong> Browser type, device type, and general location (country/region) for compatibility and performance improvements</li>
          <li><strong>Cookies:</strong> We may use cookies for analytics and advertising purposes (see Advertising section below)</li>
        </ul>
      </section>

      <section>
        <h2>Advertising</h2>
        <p>
          We use Google AdSense to display advertisements. Google may use cookies to serve ads based on your
          prior visits to this or other websites. You can opt out of personalized advertising by visiting
          <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer"> Google's Ads Settings</a>.
        </p>
        <p>
          Third-party vendors, including Google, use cookies to serve ads based on your visits to this and
          other websites. You may opt out of the use of cookies for personalized advertising by visiting
          <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer"> www.aboutads.info</a>.
        </p>
      </section>

      <section>
        <h2>Data Security</h2>
        <p>
          Since your files are processed entirely in your browser and never transmitted to our servers,
          there is no risk of your documents being intercepted, stored, or accessed by us or any third party
          through our service.
        </p>
      </section>

      <section>
        <h2>Third-Party Links</h2>
        <p>
          Our website may contain links to third-party websites. We are not responsible for the privacy
          practices of these external sites.
        </p>
      </section>

      <section>
        <h2>Children's Privacy</h2>
        <p>
          Our service is not directed to children under 13. We do not knowingly collect personal information
          from children.
        </p>
      </section>

      <section>
        <h2>Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any changes by posting
          the new policy on this page and updating the "Last updated" date.
        </p>
      </section>

      <section>
        <h2>Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, please contact us through our website.
        </p>
      </section>
    </>
  );
}

function TermsOfService() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="legal-updated">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

      <section>
        <h2>Acceptance of Terms</h2>
        <p>
          By accessing and using PDFEdit.live ("the Service"), you accept and agree to be bound by these
          Terms of Service. If you do not agree to these terms, please do not use the Service.
        </p>
      </section>

      <section>
        <h2>Description of Service</h2>
        <p>
          PDFEdit.live is a free, browser-based tool that allows you to view, edit, annotate, and manage PDF
          documents. All processing occurs locally in your web browser — your files are never uploaded to
          our servers.
        </p>
      </section>

      <section>
        <h2>Use of the Service</h2>
        <p>You agree to use the Service only for lawful purposes. You may not:</p>
        <ul>
          <li>Use the Service for any illegal or unauthorized purpose</li>
          <li>Attempt to interfere with or disrupt the Service</li>
          <li>Attempt to gain unauthorized access to any part of the Service</li>
          <li>Use the Service to process documents you do not have the right to modify</li>
          <li>Remove or alter any proprietary notices or labels on the Service</li>
        </ul>
      </section>

      <section>
        <h2>Intellectual Property</h2>
        <p>
          The Service and its original content, features, and functionality are owned by PDFEdit.live and are
          protected by international copyright, trademark, and other intellectual property laws.
        </p>
        <p>
          You retain all rights to the documents you process using our Service. We claim no ownership or
          rights to your content.
        </p>
      </section>

      <section>
        <h2>Disclaimer of Warranties</h2>
        <p>
          The Service is provided "as is" and "as available" without warranties of any kind, either express
          or implied, including but not limited to:
        </p>
        <ul>
          <li>Implied warranties of merchantability or fitness for a particular purpose</li>
          <li>That the Service will be uninterrupted, secure, or error-free</li>
          <li>That the results obtained from using the Service will be accurate or reliable</li>
          <li>That any errors in the Service will be corrected</li>
        </ul>
      </section>

      <section>
        <h2>Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, PDFEdit.live shall not be liable for any indirect, incidental,
          special, consequential, or punitive damages, including but not limited to loss of data, profits,
          or goodwill, arising from your use of the Service.
        </p>
        <p>
          <strong>Important:</strong> Always keep backup copies of your original documents. While we strive
          to provide a reliable service, we cannot guarantee that edited PDFs will work perfectly in all
          situations or with all PDF readers.
        </p>
      </section>

      <section>
        <h2>Document Responsibility</h2>
        <p>
          You are solely responsible for:
        </p>
        <ul>
          <li>Ensuring you have the legal right to view, edit, and modify any documents you process</li>
          <li>Maintaining backup copies of your original files</li>
          <li>Verifying that edited documents meet your requirements before using them</li>
          <li>The content of any documents you create, edit, or sign using the Service</li>
        </ul>
      </section>

      <section>
        <h2>Modifications to Service</h2>
        <p>
          We reserve the right to modify, suspend, or discontinue the Service at any time, with or without
          notice. We shall not be liable to you or any third party for any modification, suspension, or
          discontinuance of the Service.
        </p>
      </section>

      <section>
        <h2>Changes to Terms</h2>
        <p>
          We reserve the right to update these Terms of Service at any time. Changes will be effective
          immediately upon posting to the website. Your continued use of the Service after changes
          constitutes acceptance of the new terms.
        </p>
      </section>

      <section>
        <h2>Governing Law</h2>
        <p>
          These Terms shall be governed by and construed in accordance with applicable laws, without regard
          to conflict of law principles.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          If you have any questions about these Terms of Service, please contact us through our website.
        </p>
      </section>
    </>
  );
}

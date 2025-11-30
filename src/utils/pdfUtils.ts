import * as pdfjsLib from 'pdfjs-dist';
import { TextLayer } from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// Configure PDF.js worker using CDN for reliability
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export async function loadPDF(file: File): Promise<PDFDocumentProxy> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  });
  return loadingTask.promise;
}

export async function loadPDFFromUrl(url: string): Promise<PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument({
    url,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  });
  return loadingTask.promise;
}

export async function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
  rotation: number = 0
): Promise<void> {
  const totalRotation = (page.rotate + rotation) % 360;

  // Account for high-DPI displays
  const pixelRatio = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: scale * pixelRatio, rotation: totalRotation });

  // Set canvas size to high-res dimensions
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // Set CSS size to logical dimensions (display size)
  canvas.style.width = `${viewport.width / pixelRatio}px`;
  canvas.style.height = `${viewport.height / pixelRatio}px`;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get canvas context');

  const renderContext = {
    canvasContext: context,
    viewport,
    canvas,
  };

  await page.render(renderContext).promise;
}

export async function getPageThumbnail(
  page: PDFPageProxy,
  maxSize: number = 150,
  rotation: number = 0
): Promise<string> {
  const totalRotation = (page.rotate + rotation) % 360;
  const viewport = page.getViewport({ scale: 1, rotation: totalRotation });
  const scale = maxSize / Math.max(viewport.width, viewport.height);
  const scaledViewport = page.getViewport({ scale, rotation: totalRotation });

  const canvas = document.createElement('canvas');
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get canvas context');

  await page.render({
    canvasContext: context,
    viewport: scaledViewport,
    canvas,
  }).promise;

  return canvas.toDataURL('image/png');
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Render text layer for text selection
export async function renderTextLayer(
  page: PDFPageProxy,
  container: HTMLDivElement,
  scale: number,
  rotation: number = 0
): Promise<void> {
  // Clear existing text layer
  container.innerHTML = '';

  const totalRotation = (page.rotate + rotation) % 360;
  const viewport = page.getViewport({ scale, rotation: totalRotation });

  // Get text content
  const textContent = await page.getTextContent();

  // Create text layer
  const textLayer = new TextLayer({
    textContentSource: textContent,
    container,
    viewport,
  });

  await textLayer.render();
}

// Get text content from a page for search functionality
export async function getPageTextContent(page: PDFPageProxy): Promise<{
  items: Array<{ str: string; transform: number[]; width: number; height: number }>;
  text: string;
}> {
  const textContent = await page.getTextContent();
  const items = textContent.items.map((item: any) => ({
    str: item.str,
    transform: item.transform,
    width: item.width,
    height: item.height,
  }));
  const text = items.map(item => item.str).join(' ');
  return { items, text };
}

// Search text across all pages
export async function searchInDocument(
  pdfDoc: PDFDocumentProxy,
  searchTerm: string,
  caseSensitive: boolean = false
): Promise<Array<{ pageNumber: number; matches: Array<{ text: string; index: number }> }>> {
  const results: Array<{ pageNumber: number; matches: Array<{ text: string; index: number }> }> = [];

  const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const { text } = await getPageTextContent(page);
    const searchText = caseSensitive ? text : text.toLowerCase();

    const matches: Array<{ text: string; index: number }> = [];
    let idx = 0;
    while ((idx = searchText.indexOf(term, idx)) !== -1) {
      matches.push({
        text: text.substring(idx, idx + searchTerm.length),
        index: idx,
      });
      idx += 1;
    }

    if (matches.length > 0) {
      results.push({ pageNumber: i, matches });
    }
  }

  return results;
}

// Get form fields from PDF
export async function getFormFields(pdfDoc: PDFDocumentProxy): Promise<Array<{
  pageNumber: number;
  fields: Array<{
    name: string;
    type: string;
    rect: number[];
    value?: string;
  }>;
}>> {
  const allFields: Array<{
    pageNumber: number;
    fields: Array<{ name: string; type: string; rect: number[]; value?: string }>;
  }> = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const annotations = await page.getAnnotations();

    const fields = annotations
      .filter((annot: any) => annot.subtype === 'Widget')
      .map((annot: any) => ({
        name: annot.fieldName || '',
        type: annot.fieldType || 'unknown',
        rect: annot.rect,
        value: annot.fieldValue,
      }));

    if (fields.length > 0) {
      allFields.push({ pageNumber: i, fields });
    }
  }

  return allFields;
}

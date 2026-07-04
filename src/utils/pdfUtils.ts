import * as pdfjsLib from 'pdfjs-dist';
import { TextLayer } from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import type { Annotation } from '../types/pdf';

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
  rotation: number = 0,
  annotations?: Annotation[]
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

  if (annotations && annotations.length > 0) {
    const unrotated = page.getViewport({ scale: 1, rotation: 0 });
    await drawAnnotationsOnCanvas(context, annotations, rotation, unrotated.width, unrotated.height, scale);
  }

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Draws annotations onto a rendered page canvas. Mirrors the geometry of
// AnnotationRenderer in PageCanvas.tsx: annotations are stored in unrotated
// page space at scale 1, so they're mapped through the same page-to-screen
// rotation transform and then scaled to the canvas size.
export async function drawAnnotationsOnCanvas(
  context: CanvasRenderingContext2D,
  annotations: Annotation[],
  userRotation: number, // rotation applied in the app, excluding the page's intrinsic rotation
  pageWidth: number, // unrotated page dimensions at scale 1
  pageHeight: number,
  scale: number
): Promise<void> {
  const rot = ((userRotation % 360) + 360) % 360;

  const toScreen = (x: number, y: number): { x: number; y: number } => {
    switch (rot) {
      case 90:
        return { x: pageHeight - y, y: x };
      case 180:
        return { x: pageWidth - x, y: pageHeight - y };
      case 270:
        return { x: y, y: pageWidth - x };
      default:
        return { x, y };
    }
  };

  // Center-based box transform: dimensions swap at 90/270
  const toScreenBox = (x: number, y: number, width: number, height: number) => {
    const center = toScreen(x + width / 2, y + height / 2);
    const dims = rot === 90 || rot === 270 ? { width: height, height: width } : { width, height };
    return {
      x: center.x - dims.width / 2,
      y: center.y - dims.height / 2,
      width: dims.width,
      height: dims.height,
    };
  };

  for (const annotation of annotations) {
    context.save();
    try {
      switch (annotation.type) {
        case 'highlight': {
          const box = toScreenBox(annotation.x, annotation.y, annotation.width || 0, annotation.height || 0);
          context.fillStyle = annotation.color || 'rgba(255, 255, 0, 0.4)';
          context.fillRect(box.x * scale, box.y * scale, box.width * scale, box.height * scale);
          break;
        }
        case 'rectangle':
        case 'circle': {
          const box = toScreenBox(annotation.x, annotation.y, annotation.width || 0, annotation.height || 0);
          context.strokeStyle = annotation.color || '#ff0000';
          context.lineWidth = Math.max(1, 2 * scale);
          if (annotation.type === 'rectangle') {
            context.strokeRect(box.x * scale, box.y * scale, box.width * scale, box.height * scale);
          } else {
            context.beginPath();
            context.ellipse(
              (box.x + box.width / 2) * scale,
              (box.y + box.height / 2) * scale,
              (box.width / 2) * scale,
              (box.height / 2) * scale,
              0,
              0,
              Math.PI * 2
            );
            context.stroke();
          }
          break;
        }
        case 'drawing': {
          if (!annotation.points || annotation.points.length < 2) break;
          context.strokeStyle = annotation.color || '#ff0000';
          context.lineWidth = Math.max(1, (annotation.strokeWidth || 2) * scale);
          context.lineCap = 'round';
          context.lineJoin = 'round';
          context.beginPath();
          annotation.points.forEach((p, i) => {
            const s = toScreen(p.x, p.y);
            if (i === 0) context.moveTo(s.x * scale, s.y * scale);
            else context.lineTo(s.x * scale, s.y * scale);
          });
          context.stroke();
          break;
        }
        case 'arrow': {
          if (!annotation.points || annotation.points.length < 2) break;
          const start = toScreen(annotation.points[0].x, annotation.points[0].y);
          const end = toScreen(annotation.points[1].x, annotation.points[1].y);
          const color = annotation.color || '#ff0000';
          context.strokeStyle = color;
          context.fillStyle = color;
          context.lineWidth = Math.max(1, (annotation.strokeWidth || 2) * scale);
          context.beginPath();
          context.moveTo(start.x * scale, start.y * scale);
          context.lineTo(end.x * scale, end.y * scale);
          context.stroke();
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const head = Math.max(3, 10 * scale);
          context.beginPath();
          context.moveTo(end.x * scale, end.y * scale);
          context.lineTo(
            end.x * scale - head * Math.cos(angle - Math.PI / 6),
            end.y * scale - head * Math.sin(angle - Math.PI / 6)
          );
          context.lineTo(
            end.x * scale - head * Math.cos(angle + Math.PI / 6),
            end.y * scale - head * Math.sin(angle + Math.PI / 6)
          );
          context.closePath();
          context.fill();
          break;
        }
        case 'text': {
          if (!annotation.content) break;
          const pos = toScreen(annotation.x, annotation.y);
          const fontSize = (annotation.fontSize || 12) * scale;
          // Content annotations rotate around their top-left corner with the page
          context.translate(pos.x * scale, pos.y * scale);
          if (rot) context.rotate((rot * Math.PI) / 180);
          context.font = `${fontSize}px ${annotation.fontFamily || 'Inter, sans-serif'}`;
          context.textBaseline = 'top';
          const lines = annotation.content.split('\n');
          const lineHeight = fontSize * 1.2;
          if (annotation.backgroundColor) {
            const opacity = (annotation.backgroundOpacity ?? 100) / 100;
            const hex = annotation.backgroundColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            context.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            const maxLineWidth = Math.max(...lines.map((line) => context.measureText(line).width));
            context.fillRect(-2 * scale, -2 * scale, maxLineWidth + 8 * scale, lines.length * lineHeight + 4 * scale);
          }
          context.fillStyle = annotation.color || '#000';
          lines.forEach((line, i) => {
            context.fillText(line, 0, i * lineHeight);
          });
          break;
        }
        case 'signature':
        case 'image': {
          if (!annotation.content) break;
          const img = await loadImage(annotation.content);
          const pos = toScreen(annotation.x, annotation.y);
          const width = (annotation.width || (annotation.type === 'signature' ? 150 : 200)) * scale;
          const height = (annotation.height || (annotation.type === 'signature' ? 75 : 150)) * scale;
          context.translate(pos.x * scale, pos.y * scale);
          if (rot) context.rotate((rot * Math.PI) / 180);
          // object-fit: contain
          const ratio = Math.min(width / img.width, height / img.height);
          const drawWidth = img.width * ratio;
          const drawHeight = img.height * ratio;
          context.drawImage(img, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
          break;
        }
      }
    } catch {
      // Skip annotations that fail to draw (e.g. broken image data) so one
      // bad annotation doesn't blank the whole thumbnail
    } finally {
      context.restore();
    }
  }
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

// Sanitize PDF by removing all metadata
export async function sanitizePDF(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  // Clear all standard metadata fields
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setCreator('');
  pdfDoc.setProducer('');
  pdfDoc.setCreationDate(new Date(0)); // Set to epoch
  pdfDoc.setModificationDate(new Date(0));

  // Save the sanitized PDF
  const sanitizedPdf = await pdfDoc.save();

  return sanitizedPdf;
}

// Download sanitized PDF
export async function downloadSanitizedPDF(file: File, newFileName?: string): Promise<void> {
  const sanitizedPdf = await sanitizePDF(file);

  // Create blob and download
  const blob = new Blob([new Uint8Array(sanitizedPdf)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;

  // Generate filename
  const originalName = file.name.replace(/\.pdf$/i, '');
  link.download = newFileName || `${originalName}_sanitized.pdf`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

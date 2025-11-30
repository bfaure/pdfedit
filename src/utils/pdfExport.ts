import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import type { Annotation } from '../types/pdf';

interface ExportOptions {
  originalFile: File;
  annotations: Annotation[];
  pageRotations: Map<number, number>;
  deletedPages: Set<number>;
  pageOrder: number[];
  globalRotation: number;
}

export async function exportPDF(options: ExportOptions): Promise<Blob> {
  const { originalFile, annotations, pageRotations, deletedPages, pageOrder, globalRotation } = options;

  // Load the original PDF
  const originalBytes = await originalFile.arrayBuffer();
  const srcDoc = await PDFDocument.load(originalBytes);

  // Create a new PDF document for the output
  const pdfDoc = await PDFDocument.create();

  // Get the font for text annotations
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Determine the final page order (excluding deleted pages)
  const finalPageOrder = pageOrder.length > 0
    ? pageOrder.filter(p => !deletedPages.has(p))
    : Array.from({ length: srcDoc.getPageCount() }, (_, i) => i + 1).filter(p => !deletedPages.has(p));

  // Copy pages in the new order
  for (const originalPageNumber of finalPageOrder) {
    const [copiedPage] = await pdfDoc.copyPages(srcDoc, [originalPageNumber - 1]);
    pdfDoc.addPage(copiedPage);
  }

  // Get the pages from the new document
  const pages = pdfDoc.getPages();

  // Apply rotations and annotations to each page
  for (let i = 0; i < pages.length; i++) {
    const originalPageNumber = finalPageOrder[i];
    const page = pages[i];

    // Apply rotation
    const pageRotation = pageRotations.get(originalPageNumber) || 0;
    const totalRotation = (globalRotation + pageRotation) % 360;
    if (totalRotation !== 0) {
      page.setRotation(degrees(totalRotation));
    }

    // Get page dimensions
    const { height } = page.getSize();

    // Add annotations for this page
    const pageAnnotations = annotations.filter((a) => a.pageNumber === originalPageNumber);

    for (const annotation of pageAnnotations) {
      switch (annotation.type) {
        case 'text':
          if (annotation.content) {
            const color = hexToRgb(annotation.color || '#000000');
            page.drawText(annotation.content, {
              x: annotation.x,
              y: height - annotation.y - (annotation.fontSize || 16),
              size: annotation.fontSize || 16,
              font,
              color: rgb(color.r, color.g, color.b),
            });
          }
          break;

        case 'highlight':
          if (annotation.width && annotation.height) {
            const color = parseRgba(annotation.color || 'rgba(255, 255, 0, 0.4)');
            page.drawRectangle({
              x: annotation.x,
              y: height - annotation.y - annotation.height,
              width: annotation.width,
              height: annotation.height,
              color: rgb(color.r, color.g, color.b),
              opacity: color.a,
            });
          }
          break;

        case 'rectangle':
          if (annotation.width && annotation.height) {
            const color = hexToRgb(annotation.color || '#ff0000');
            page.drawRectangle({
              x: annotation.x,
              y: height - annotation.y - annotation.height,
              width: annotation.width,
              height: annotation.height,
              borderColor: rgb(color.r, color.g, color.b),
              borderWidth: 2,
            });
          }
          break;

        case 'circle':
          if (annotation.width && annotation.height) {
            const color = hexToRgb(annotation.color || '#ff0000');
            const centerX = annotation.x + annotation.width / 2;
            const centerY = height - annotation.y - annotation.height / 2;
            page.drawEllipse({
              x: centerX,
              y: centerY,
              xScale: annotation.width / 2,
              yScale: annotation.height / 2,
              borderColor: rgb(color.r, color.g, color.b),
              borderWidth: 2,
            });
          }
          break;

        case 'drawing':
          if (annotation.points && annotation.points.length >= 2) {
            const color = hexToRgb(annotation.color || '#ff0000');
            for (let j = 0; j < annotation.points.length - 1; j++) {
              const start = annotation.points[j];
              const end = annotation.points[j + 1];
              page.drawLine({
                start: { x: start.x, y: height - start.y },
                end: { x: end.x, y: height - end.y },
                thickness: 2,
                color: rgb(color.r, color.g, color.b),
              });
            }
          }
          break;

        case 'arrow':
          if (annotation.points && annotation.points.length >= 2) {
            const [start, end] = annotation.points;
            const color = hexToRgb(annotation.color || '#ff0000');

            // Draw the line
            page.drawLine({
              start: { x: start.x, y: height - start.y },
              end: { x: end.x, y: height - end.y },
              thickness: 2,
              color: rgb(color.r, color.g, color.b),
            });

            // Draw arrowhead
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const arrowLength = 10;
            const arrowAngle = Math.PI / 6;

            const arrow1X = end.x - arrowLength * Math.cos(angle - arrowAngle);
            const arrow1Y = height - (end.y - arrowLength * Math.sin(angle - arrowAngle));
            const arrow2X = end.x - arrowLength * Math.cos(angle + arrowAngle);
            const arrow2Y = height - (end.y - arrowLength * Math.sin(angle + arrowAngle));

            page.drawLine({
              start: { x: end.x, y: height - end.y },
              end: { x: arrow1X, y: arrow1Y },
              thickness: 2,
              color: rgb(color.r, color.g, color.b),
            });
            page.drawLine({
              start: { x: end.x, y: height - end.y },
              end: { x: arrow2X, y: arrow2Y },
              thickness: 2,
              color: rgb(color.r, color.g, color.b),
            });
          }
          break;

        case 'signature':
          if (annotation.content && annotation.width && annotation.height) {
            try {
              // Convert data URL to bytes
              const imageData = annotation.content.split(',')[1];
              const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
              const pngImage = await pdfDoc.embedPng(imageBytes);

              page.drawImage(pngImage, {
                x: annotation.x,
                y: height - annotation.y - annotation.height,
                width: annotation.width,
                height: annotation.height,
              });
            } catch (error) {
              console.error('Failed to embed signature:', error);
            }
          }
          break;
      }
    }
  }

  // Save the modified PDF
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
}

export async function mergePDFs(files: File[]): Promise<Blob> {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
  }

  const pdfBytes = await mergedPdf.save();
  return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    };
  }
  return { r: 0, g: 0, b: 0 };
}

function parseRgba(rgba: string): { r: number; g: number; b: number; a: number } {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    return {
      r: parseInt(match[1], 10) / 255,
      g: parseInt(match[2], 10) / 255,
      b: parseInt(match[3], 10) / 255,
      a: match[4] ? parseFloat(match[4]) : 1,
    };
  }
  return { r: 1, g: 1, b: 0, a: 0.4 };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Extract specific pages from PDF
export async function extractPages(file: File, pageNumbers: number[]): Promise<Blob> {
  const bytes = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(bytes);
  const newDoc = await PDFDocument.create();

  // Sort page numbers and filter valid ones
  const validPages = pageNumbers
    .filter(p => p >= 1 && p <= srcDoc.getPageCount())
    .sort((a, b) => a - b);

  if (validPages.length === 0) {
    throw new Error('No valid pages to extract');
  }

  // Copy pages (convert to 0-indexed)
  const copiedPages = await newDoc.copyPages(srcDoc, validPages.map(p => p - 1));
  copiedPages.forEach(page => newDoc.addPage(page));

  const pdfBytes = await newDoc.save();
  return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
}

// Split PDF at specific page numbers
export async function splitPDF(
  file: File,
  splitPoints: number[]
): Promise<Array<{ blob: Blob; name: string; startPage: number; endPage: number }>> {
  const bytes = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(bytes);
  const totalPages = srcDoc.getPageCount();

  // Sort and dedupe split points, add boundaries
  const points = [...new Set([0, ...splitPoints.filter(p => p > 0 && p < totalPages), totalPages])]
    .sort((a, b) => a - b);

  const results: Array<{ blob: Blob; name: string; startPage: number; endPage: number }> = [];
  const baseName = file.name.replace(/\.pdf$/i, '');

  for (let i = 0; i < points.length - 1; i++) {
    const startPage = points[i] + 1; // 1-indexed
    const endPage = points[i + 1];   // 1-indexed (inclusive)

    const newDoc = await PDFDocument.create();
    const pageIndices = Array.from(
      { length: endPage - startPage + 1 },
      (_, idx) => startPage - 1 + idx
    );

    const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach(page => newDoc.addPage(page));

    const pdfBytes = await newDoc.save();
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });

    results.push({
      blob,
      name: `${baseName}_part${i + 1}_pages${startPage}-${endPage}.pdf`,
      startPage,
      endPage,
    });
  }

  return results;
}

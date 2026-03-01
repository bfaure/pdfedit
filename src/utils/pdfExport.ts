import { PDFDocument, rgb, StandardFonts, degrees, type PDFPage } from 'pdf-lib';
import type { Annotation, MetadataOverrides } from '../types/pdf';

/**
 * Transform annotation coordinates from our page-space (top-left origin, y-down)
 * to pdf-lib MediaBox space (bottom-left origin, y-up), accounting for page rotation.
 *
 * When a page has rotation set, the PDF viewer rotates the entire page including
 * anything drawn on it. So we must draw annotations in the INVERSE-rotated position
 * so that after the viewer applies rotation, they appear in the correct place.
 */
function transformForRotation(
  x: number, y: number,
  w: number, h: number,
  pageWidth: number, pageHeight: number,
  rotation: number
): { x: number; y: number; w: number; h: number; rotate: number } {
  const rot = ((rotation % 360) + 360) % 360;
  switch (rot) {
    case 0:
      // No rotation: just flip y for pdf-lib coordinate system
      return { x, y: pageHeight - y - h, w, h, rotate: 0 };
    case 90:
      // Page rotated 90° CW in viewer. To counteract:
      // draw in position that after 90° CW rotation lands where user intended
      return { x: y, y: x, w: h, h: w, rotate: -90 };
    case 180:
      // Page rotated 180° in viewer. To counteract:
      return { x: pageWidth - x - w, y: y, w, h, rotate: 180 };
    case 270:
      // Page rotated 270° CW in viewer. To counteract:
      return { x: pageHeight - y - h, y: pageWidth - x - w, w: h, h: w, rotate: 90 };
    default:
      return { x, y: pageHeight - y - h, w, h, rotate: 0 };
  }
}

function transformPointForRotation(
  x: number, y: number,
  pageWidth: number, pageHeight: number,
  rotation: number
): { x: number; y: number } {
  const rot = ((rotation % 360) + 360) % 360;
  switch (rot) {
    case 0:
      return { x, y: pageHeight - y };
    case 90:
      return { x: y, y: x };
    case 180:
      return { x: pageWidth - x, y };
    case 270:
      return { x: pageHeight - y, y: pageWidth - x };
    default:
      return { x, y: pageHeight - y };
  }
}

function drawAnnotationOnPage(
  page: PDFPage,
  annotation: Annotation,
  font: Awaited<ReturnType<typeof PDFDocument.prototype.embedFont>>,
  pdfDoc: PDFDocument,
  totalRotation: number
): Promise<void> | void {
  const { width: pageWidth, height: pageHeight } = page.getSize();

  switch (annotation.type) {
    case 'text':
      if (annotation.content) {
        const fontSize = annotation.fontSize || 12;
        const color = hexToRgb(annotation.color || '#000000');
        const t = transformForRotation(
          annotation.x, annotation.y,
          0, fontSize,
          pageWidth, pageHeight, totalRotation
        );
        page.drawText(annotation.content, {
          x: t.x,
          y: t.y,
          size: fontSize,
          font,
          color: rgb(color.r, color.g, color.b),
          rotate: degrees(t.rotate),
        });
      }
      break;

    case 'highlight':
      if (annotation.width && annotation.height) {
        const color = parseRgba(annotation.color || 'rgba(255, 255, 0, 0.4)');
        const t = transformForRotation(
          annotation.x, annotation.y,
          annotation.width, annotation.height,
          pageWidth, pageHeight, totalRotation
        );
        page.drawRectangle({
          x: t.x,
          y: t.y,
          width: t.w,
          height: t.h,
          color: rgb(color.r, color.g, color.b),
          opacity: color.a,
          rotate: degrees(t.rotate),
        });
      }
      break;

    case 'rectangle':
      if (annotation.width && annotation.height) {
        const color = hexToRgb(annotation.color || '#ff0000');
        const t = transformForRotation(
          annotation.x, annotation.y,
          annotation.width, annotation.height,
          pageWidth, pageHeight, totalRotation
        );
        page.drawRectangle({
          x: t.x,
          y: t.y,
          width: t.w,
          height: t.h,
          borderColor: rgb(color.r, color.g, color.b),
          borderWidth: 2,
          rotate: degrees(t.rotate),
        });
      }
      break;

    case 'circle':
      if (annotation.width && annotation.height) {
        const color = hexToRgb(annotation.color || '#ff0000');
        const t = transformForRotation(
          annotation.x, annotation.y,
          annotation.width, annotation.height,
          pageWidth, pageHeight, totalRotation
        );
        const centerX = t.x + t.w / 2;
        const centerY = t.y + t.h / 2;
        page.drawEllipse({
          x: centerX,
          y: centerY,
          xScale: t.w / 2,
          yScale: t.h / 2,
          borderColor: rgb(color.r, color.g, color.b),
          borderWidth: 2,
        });
      }
      break;

    case 'drawing':
      if (annotation.points && annotation.points.length >= 2) {
        const color = hexToRgb(annotation.color || '#ff0000');
        const drawThickness = annotation.strokeWidth || 2;
        for (let j = 0; j < annotation.points.length - 1; j++) {
          const startPt = annotation.points[j];
          const endPt = annotation.points[j + 1];
          const tStart = transformPointForRotation(startPt.x, startPt.y, pageWidth, pageHeight, totalRotation);
          const tEnd = transformPointForRotation(endPt.x, endPt.y, pageWidth, pageHeight, totalRotation);
          page.drawLine({
            start: tStart,
            end: tEnd,
            thickness: drawThickness,
            color: rgb(color.r, color.g, color.b),
          });
        }
      }
      break;

    case 'arrow':
      if (annotation.points && annotation.points.length >= 2) {
        const [start, end] = annotation.points;
        const color = hexToRgb(annotation.color || '#ff0000');
        const arrowThickness = annotation.strokeWidth || 2;
        const tStart = transformPointForRotation(start.x, start.y, pageWidth, pageHeight, totalRotation);
        const tEnd = transformPointForRotation(end.x, end.y, pageWidth, pageHeight, totalRotation);

        page.drawLine({
          start: tStart,
          end: tEnd,
          thickness: arrowThickness,
          color: rgb(color.r, color.g, color.b),
        });

        // Draw arrowhead
        const angle = Math.atan2(tEnd.y - tStart.y, tEnd.x - tStart.x);
        const arrowLength = 10;
        const arrowAngle = Math.PI / 6;

        page.drawLine({
          start: tEnd,
          end: {
            x: tEnd.x - arrowLength * Math.cos(angle - arrowAngle),
            y: tEnd.y - arrowLength * Math.sin(angle - arrowAngle),
          },
          thickness: arrowThickness,
          color: rgb(color.r, color.g, color.b),
        });
        page.drawLine({
          start: tEnd,
          end: {
            x: tEnd.x - arrowLength * Math.cos(angle + arrowAngle),
            y: tEnd.y - arrowLength * Math.sin(angle + arrowAngle),
          },
          thickness: arrowThickness,
          color: rgb(color.r, color.g, color.b),
        });
      }
      break;

    case 'signature':
    case 'image':
      if (annotation.content && annotation.width && annotation.height) {
        const t = transformForRotation(
          annotation.x, annotation.y,
          annotation.width, annotation.height,
          pageWidth, pageHeight, totalRotation
        );
        return (async () => {
          try {
            const isJpeg = annotation.content!.startsWith('data:image/jpeg') ||
                          annotation.content!.startsWith('data:image/jpg');
            const imageData = annotation.content!.split(',')[1];
            const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));

            const embeddedImage = annotation.type === 'signature'
              ? await pdfDoc.embedPng(imageBytes)
              : isJpeg
                ? await pdfDoc.embedJpg(imageBytes)
                : await pdfDoc.embedPng(imageBytes);

            page.drawImage(embeddedImage, {
              x: t.x,
              y: t.y,
              width: t.w,
              height: t.h,
              rotate: degrees(t.rotate),
            });
          } catch (error) {
            console.error(`Failed to embed ${annotation.type}:`, error);
          }
        })();
      }
      break;
  }
}

interface ExportOptions {
  originalFile: File;
  annotations: Annotation[];
  pageRotations: Map<number, number>;
  deletedPages: Set<number>;
  pageOrder: number[];
  globalRotation: number;
  metadataOverrides?: MetadataOverrides;
}

export async function exportPDF(options: ExportOptions): Promise<Blob> {
  const { originalFile, annotations, pageRotations, deletedPages, pageOrder, globalRotation, metadataOverrides = {} } = options;

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

    // Add annotations for this page, using rotation-aware coordinate transforms
    const pageAnnotations = annotations.filter((a) => a.pageNumber === originalPageNumber);
    for (const annotation of pageAnnotations) {
      await drawAnnotationOnPage(page, annotation, font, pdfDoc, totalRotation);
    }
  }

  // Apply metadata overrides
  if (metadataOverrides.stripAll) {
    // Strip all metadata
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setCreator('');
    pdfDoc.setProducer('');
    pdfDoc.setCreationDate(new Date(0));
    pdfDoc.setModificationDate(new Date(0));
  } else {
    // Apply individual field overrides
    if (metadataOverrides.title !== undefined) {
      pdfDoc.setTitle(metadataOverrides.title === null ? '' : metadataOverrides.title);
    }
    if (metadataOverrides.author !== undefined) {
      pdfDoc.setAuthor(metadataOverrides.author === null ? '' : metadataOverrides.author);
    }
    if (metadataOverrides.subject !== undefined) {
      pdfDoc.setSubject(metadataOverrides.subject === null ? '' : metadataOverrides.subject);
    }
    if (metadataOverrides.keywords !== undefined) {
      const keywords = metadataOverrides.keywords === null ? [] : metadataOverrides.keywords.split(',').map(k => k.trim()).filter(k => k);
      pdfDoc.setKeywords(keywords);
    }
    if (metadataOverrides.creator !== undefined) {
      pdfDoc.setCreator(metadataOverrides.creator === null ? '' : metadataOverrides.creator);
    }
    if (metadataOverrides.producer !== undefined) {
      pdfDoc.setProducer(metadataOverrides.producer === null ? '' : metadataOverrides.producer);
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

import React, { useState, useCallback } from 'react';
import { usePDF } from '../contexts/PDFContext';
import './FileDropZone.css';

interface FileDropZoneProps {
  children: React.ReactNode;
}

export function FileDropZone({ children }: FileDropZoneProps) {
  const { loadFile } = usePDF();
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = React.useRef(0);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;

    // Ignore internal page reorder drags
    const isInternalDrag = e.dataTransfer.types.includes('application/x-pdf-page-reorder');
    if (isInternalDrag) return;

    // Only show overlay for file drags from outside the browser
    const hasFiles = e.dataTransfer.types.includes('Files');
    if (hasFiles && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore internal page reorder drags
    const isInternalDrag = e.dataTransfer.types.includes('application/x-pdf-page-reorder');
    if (isInternalDrag) return;

    dragCounter.current--;

    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      // Ignore internal page reorder drags
      const isInternalDrag = e.dataTransfer.types.includes('application/x-pdf-page-reorder');
      if (isInternalDrag) return;

      // Only process file drops
      const hasFiles = e.dataTransfer.types.includes('Files');
      if (!hasFiles) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type === 'application/pdf') {
          await loadFile(file);
        } else {
          alert('Please drop a PDF file');
        }
      }
    },
    [loadFile]
  );

  return (
    <div
      className="file-drop-zone"
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {children}
      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-content">
            <span className="drop-icon">📄</span>
            <span className="drop-text">Drop PDF here</span>
          </div>
        </div>
      )}
    </div>
  );
}

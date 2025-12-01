import { useEffect, useCallback } from 'react';
import { usePDF } from '../contexts/PDFContext';

export function useKeyboardShortcuts() {
  const {
    state,
    canUndo,
    canRedo,
    navigateToPage,
    setScale,
    setRotation,
    setTool,
    undo,
    redo,
  } = usePDF();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Page navigation
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        navigateToPage(state.currentPage - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        navigateToPage(state.currentPage + 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        navigateToPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        navigateToPage(state.numPages);
      }

      // Zoom controls and undo/redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setScale(state.scale * 1.25);
        } else if (e.key === '-') {
          e.preventDefault();
          setScale(state.scale * 0.8);
        } else if (e.key === '0') {
          e.preventDefault();
          setScale(1);
        } else if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          if (canUndo) undo();
        } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          if (canRedo) redo();
        }
      }

      // Rotation
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setRotation(state.rotation + (e.shiftKey ? -90 : 90));
      }

      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            setTool('select');
            break;
          case 'h':
            setTool('pan');
            break;
          case 'm':
            setTool('highlight');
            break;
          case 't':
            setTool('text');
            break;
          case 'p':
            setTool('draw');
            break;
          case 'u':
            setTool('rectangle');
            break;
          case 'o':
            setTool('circle');
            break;
          case 'a':
            setTool('arrow');
            break;
          case 'e':
            setTool('eraser');
            break;
        }
      }

      // Escape to deselect tool
      if (e.key === 'Escape') {
        setTool('select');
      }
    },
    [state, canUndo, canRedo, navigateToPage, setScale, setRotation, setTool, undo, redo]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

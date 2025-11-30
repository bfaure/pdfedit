import React, { createContext, useContext, useReducer, useCallback, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPDF, generateId } from '../utils/pdfUtils';
import type { PDFState, Annotation, Tool, ViewerSettings, HistoryEntry, HistoryActionType } from '../types/pdf';

export interface SearchHighlight {
  pageNumber: number;
  term: string;
  matchIndex: number;
}

interface PDFContextValue {
  state: PDFState;
  settings: ViewerSettings;
  pdfDocument: PDFDocumentProxy | null;
  currentTool: Tool;
  canUndo: boolean;
  canRedo: boolean;
  history: HistoryEntry[];
  historyIndex: number;
  searchHighlight: SearchHighlight | null;
  // Actions
  loadFile: (file: File) => Promise<void>;
  setCurrentPage: (page: number) => void;
  setScale: (scale: number) => void;
  setRotation: (rotation: number) => void;
  rotatePage: (pageNumber: number, rotation: number) => void;
  deletePage: (pageNumber: number) => void;
  restorePage: (pageNumber: number) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  addAnnotation: (annotation: Omit<Annotation, 'id'>) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  setTool: (tool: Tool) => void;
  updateSettings: (settings: Partial<ViewerSettings>) => void;
  setSearchHighlight: (highlight: SearchHighlight | null) => void;
  fitToPageRequest: number;
  requestFitToPage: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

type PDFAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'LOAD_PDF'; payload: { file: File; numPages: number } }
  | { type: 'SET_CURRENT_PAGE'; payload: number }
  | { type: 'SET_SCALE'; payload: number }
  | { type: 'SET_ROTATION'; payload: number }
  | { type: 'ROTATE_PAGE'; payload: { pageNumber: number; rotation: number } }
  | { type: 'DELETE_PAGE'; payload: number }
  | { type: 'RESTORE_PAGE'; payload: number }
  | { type: 'REORDER_PAGES'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'ADD_ANNOTATION'; payload: Annotation }
  | { type: 'UPDATE_ANNOTATION'; payload: { id: string; updates: Partial<Annotation> } }
  | { type: 'DELETE_ANNOTATION'; payload: string }
  | { type: 'RESTORE_STATE'; payload: Partial<PDFState> }
  | { type: 'RESET' };

const initialState: PDFState = {
  file: null,
  fileName: '',
  numPages: 0,
  currentPage: 1,
  scale: 1,
  rotation: 0,
  annotations: [],
  pageRotations: new Map(),
  deletedPages: new Set(),
  pageOrder: [],
  isLoading: false,
  error: null,
};

const initialSettings: ViewerSettings = {
  showThumbnails: true,
  showAnnotations: true,
  continuousScroll: true,
  theme: 'system',
};

function pdfReducer(state: PDFState, action: PDFAction): PDFState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'LOAD_PDF': {
      const numPages = action.payload.numPages;
      return {
        ...initialState,
        file: action.payload.file,
        fileName: action.payload.file.name,
        numPages: numPages,
        currentPage: 1,
        pageOrder: Array.from({ length: numPages }, (_, i) => i + 1),
      };
    }
    case 'SET_CURRENT_PAGE':
      return { ...state, currentPage: Math.max(1, Math.min(action.payload, state.numPages)) };
    case 'SET_SCALE':
      return { ...state, scale: Math.max(0.25, Math.min(action.payload, 5)) };
    case 'SET_ROTATION':
      return { ...state, rotation: action.payload % 360 };
    case 'ROTATE_PAGE': {
      const newRotations = new Map(state.pageRotations);
      const current = newRotations.get(action.payload.pageNumber) || 0;
      newRotations.set(action.payload.pageNumber, (current + action.payload.rotation) % 360);
      return { ...state, pageRotations: newRotations };
    }
    case 'DELETE_PAGE': {
      const newDeleted = new Set(state.deletedPages);
      newDeleted.add(action.payload);
      return { ...state, deletedPages: newDeleted };
    }
    case 'RESTORE_PAGE': {
      const newDeleted = new Set(state.deletedPages);
      newDeleted.delete(action.payload);
      return { ...state, deletedPages: newDeleted };
    }
    case 'REORDER_PAGES': {
      const { fromIndex, toIndex } = action.payload;
      const newOrder = [...state.pageOrder];
      const [movedPage] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, movedPage);
      return { ...state, pageOrder: newOrder };
    }
    case 'ADD_ANNOTATION':
      return { ...state, annotations: [...state.annotations, action.payload] };
    case 'UPDATE_ANNOTATION':
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === action.payload.id ? { ...a, ...action.payload.updates } : a
        ),
      };
    case 'DELETE_ANNOTATION':
      return {
        ...state,
        annotations: state.annotations.filter((a) => a.id !== action.payload),
      };
    case 'RESTORE_STATE': {
      const payload = action.payload;
      return {
        ...state,
        ...(payload.annotations !== undefined && { annotations: payload.annotations }),
        ...(payload.pageRotations !== undefined && { pageRotations: payload.pageRotations }),
        ...(payload.deletedPages !== undefined && { deletedPages: payload.deletedPages }),
        ...(payload.pageOrder !== undefined && { pageOrder: payload.pageOrder }),
        ...(payload.rotation !== undefined && { rotation: payload.rotation }),
      };
    }
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const PDFContext = createContext<PDFContextValue | null>(null);

export function PDFProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(pdfReducer, initialState);
  const [settings, setSettings] = useState<ViewerSettings>(initialSettings);
  const [currentTool, setCurrentTool] = useState<Tool>('select');
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);

  // Comprehensive history system
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  // Search highlight
  const [searchHighlight, setSearchHighlight] = useState<SearchHighlight | null>(null);

  // Fit to page request counter (incremented to trigger fit)
  const [fitToPageRequest, setFitToPageRequest] = useState(0);

  // Helper to create history entry
  const createHistoryEntry = useCallback((
    type: HistoryActionType,
    description: string,
    undoData: HistoryEntry['undoData'],
    redoData: HistoryEntry['redoData']
  ): HistoryEntry => ({
    id: generateId(),
    type,
    description,
    timestamp: Date.now(),
    undoData,
    redoData,
  }), []);

  // Push to history
  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistory(prev => {
      // Remove any redo history when new action is performed
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(entry);
      // Keep only last 50 entries
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const loadFile = useCallback(async (file: File) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      if (pdfDocument) {
        pdfDocument.destroy();
      }

      const pdfDoc = await loadPDF(file);
      setPdfDocument(pdfDoc);
      dispatch({ type: 'LOAD_PDF', payload: { file, numPages: pdfDoc.numPages } });
      // Clear history when loading new file
      setHistory([]);
      setHistoryIndex(-1);
    } catch (error) {
      console.error('Failed to load PDF:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to load PDF',
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [pdfDocument]);

  const setCurrentPage = useCallback((page: number) => {
    dispatch({ type: 'SET_CURRENT_PAGE', payload: page });
  }, []);

  const setScale = useCallback((scale: number) => {
    dispatch({ type: 'SET_SCALE', payload: scale });
  }, []);

  const setRotation = useCallback((rotation: number) => {
    const entry = createHistoryEntry(
      'rotate_all',
      `Rotate all pages ${rotation > state.rotation ? 'clockwise' : 'counter-clockwise'}`,
      { globalRotation: state.rotation },
      { globalRotation: rotation % 360 }
    );
    dispatch({ type: 'SET_ROTATION', payload: rotation });
    pushHistory(entry);
  }, [state.rotation, createHistoryEntry, pushHistory]);

  const rotatePage = useCallback((pageNumber: number, rotation: number) => {
    const currentRotation = state.pageRotations.get(pageNumber) || 0;
    const newRotation = (currentRotation + rotation) % 360;

    const entry = createHistoryEntry(
      'rotate_page',
      `Rotate page ${pageNumber} ${rotation > 0 ? 'clockwise' : 'counter-clockwise'}`,
      { pageRotations: new Map(state.pageRotations) },
      { pageRotations: new Map(state.pageRotations).set(pageNumber, newRotation) }
    );
    dispatch({ type: 'ROTATE_PAGE', payload: { pageNumber, rotation } });
    pushHistory(entry);
  }, [state.pageRotations, createHistoryEntry, pushHistory]);

  const deletePage = useCallback((pageNumber: number) => {
    const entry = createHistoryEntry(
      'delete_page',
      `Delete page ${pageNumber}`,
      { deletedPages: new Set(state.deletedPages) },
      { deletedPages: new Set(state.deletedPages).add(pageNumber) }
    );
    dispatch({ type: 'DELETE_PAGE', payload: pageNumber });
    pushHistory(entry);
  }, [state.deletedPages, createHistoryEntry, pushHistory]);

  const restorePage = useCallback((pageNumber: number) => {
    const newDeleted = new Set(state.deletedPages);
    newDeleted.delete(pageNumber);

    const entry = createHistoryEntry(
      'restore_page',
      `Restore page ${pageNumber}`,
      { deletedPages: new Set(state.deletedPages) },
      { deletedPages: newDeleted }
    );
    dispatch({ type: 'RESTORE_PAGE', payload: pageNumber });
    pushHistory(entry);
  }, [state.deletedPages, createHistoryEntry, pushHistory]);

  const reorderPages = useCallback((fromIndex: number, toIndex: number) => {
    const pageNumber = state.pageOrder[fromIndex];
    const newOrder = [...state.pageOrder];
    const [movedPage] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedPage);

    const entry = createHistoryEntry(
      'reorder_pages',
      `Move page ${pageNumber} from position ${fromIndex + 1} to ${toIndex + 1}`,
      { pageOrder: [...state.pageOrder] },
      { pageOrder: newOrder }
    );
    dispatch({ type: 'REORDER_PAGES', payload: { fromIndex, toIndex } });
    pushHistory(entry);
  }, [state.pageOrder, createHistoryEntry, pushHistory]);

  const addAnnotation = useCallback((annotation: Omit<Annotation, 'id'>) => {
    const newAnnotation: Annotation = {
      ...annotation,
      id: generateId(),
    };

    const entry = createHistoryEntry(
      'add_annotation',
      `Add ${annotation.type} annotation on page ${annotation.pageNumber}`,
      { annotations: [...state.annotations] },
      { annotations: [...state.annotations, newAnnotation] }
    );
    dispatch({ type: 'ADD_ANNOTATION', payload: newAnnotation });
    pushHistory(entry);
  }, [state.annotations, createHistoryEntry, pushHistory]);

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    const annotation = state.annotations.find(a => a.id === id);
    if (!annotation) return;

    const updatedAnnotations = state.annotations.map((a) =>
      a.id === id ? { ...a, ...updates } : a
    );

    const entry = createHistoryEntry(
      'update_annotation',
      `Update ${annotation.type} annotation`,
      { annotations: [...state.annotations] },
      { annotations: updatedAnnotations }
    );
    dispatch({ type: 'UPDATE_ANNOTATION', payload: { id, updates } });
    pushHistory(entry);
  }, [state.annotations, createHistoryEntry, pushHistory]);

  const deleteAnnotation = useCallback((id: string) => {
    const annotation = state.annotations.find(a => a.id === id);
    if (!annotation) return;

    const filteredAnnotations = state.annotations.filter((a) => a.id !== id);

    const entry = createHistoryEntry(
      'delete_annotation',
      `Delete ${annotation.type} annotation from page ${annotation.pageNumber}`,
      { annotations: [...state.annotations] },
      { annotations: filteredAnnotations }
    );
    dispatch({ type: 'DELETE_ANNOTATION', payload: id });
    pushHistory(entry);
  }, [state.annotations, createHistoryEntry, pushHistory]);

  const undo = useCallback(() => {
    if (historyIndex < 0) return;

    const entry = history[historyIndex];
    dispatch({ type: 'RESTORE_STATE', payload: entry.undoData });
    setHistoryIndex(prev => prev - 1);
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    const entry = history[historyIndex + 1];
    dispatch({ type: 'RESTORE_STATE', payload: entry.redoData });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex, history]);

  const setTool = useCallback((tool: Tool) => {
    setCurrentTool(tool);
  }, []);

  const updateSettings = useCallback((newSettings: Partial<ViewerSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const reset = useCallback(() => {
    if (pdfDocument) {
      pdfDocument.destroy();
      setPdfDocument(null);
    }
    dispatch({ type: 'RESET' });
    setCurrentTool('select');
    setHistory([]);
    setHistoryIndex(-1);
  }, [pdfDocument]);

  const requestFitToPage = useCallback(() => {
    setFitToPageRequest(prev => prev + 1);
  }, []);

  const value: PDFContextValue = {
    state,
    settings,
    pdfDocument,
    currentTool,
    canUndo,
    canRedo,
    history,
    historyIndex,
    loadFile,
    setCurrentPage,
    setScale,
    setRotation,
    rotatePage,
    deletePage,
    restorePage,
    reorderPages,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    setTool,
    updateSettings,
    searchHighlight,
    setSearchHighlight,
    fitToPageRequest,
    requestFitToPage,
    undo,
    redo,
    reset,
  };

  return <PDFContext.Provider value={value}>{children}</PDFContext.Provider>;
}

export function usePDF() {
  const context = useContext(PDFContext);
  if (!context) {
    throw new Error('usePDF must be used within a PDFProvider');
  }
  return context;
}

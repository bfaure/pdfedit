export interface PDFPageInfo {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
}

export interface Annotation {
  id: string;
  type: 'highlight' | 'text' | 'drawing' | 'rectangle' | 'circle' | 'arrow' | 'signature';
  pageNumber: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  backgroundColor?: string;
  backgroundOpacity?: number;
  points?: { x: number; y: number }[];
}

export interface PDFState {
  file: File | null;
  fileName: string;
  numPages: number;
  currentPage: number;
  scale: number;
  rotation: number;
  annotations: Annotation[];
  pageRotations: Map<number, number>;
  deletedPages: Set<number>;
  pageOrder: number[]; // Array of page numbers in display order
  isLoading: boolean;
  error: string | null;
  metadataSanitized: boolean; // Flag to strip metadata on export
}

export type Tool =
  | 'select'
  | 'pan'
  | 'highlight'
  | 'text'
  | 'draw'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'signature'
  | 'eraser';

export interface ViewerSettings {
  showThumbnails: boolean;
  showAnnotations: boolean;
  continuousScroll: boolean;
  theme: 'light' | 'dark' | 'system';
}

export type HistoryActionType =
  | 'add_annotation'
  | 'update_annotation'
  | 'delete_annotation'
  | 'rotate_page'
  | 'delete_page'
  | 'restore_page'
  | 'reorder_pages'
  | 'rotate_all';

export interface HistoryEntry {
  id: string;
  type: HistoryActionType;
  description: string;
  timestamp: number;
  // Snapshot of relevant state for undo
  undoData: {
    annotations?: Annotation[];
    pageRotations?: Map<number, number>;
    deletedPages?: Set<number>;
    pageOrder?: number[];
    globalRotation?: number;
  };
  // Snapshot for redo
  redoData: {
    annotations?: Annotation[];
    pageRotations?: Map<number, number>;
    deletedPages?: Set<number>;
    pageOrder?: number[];
    globalRotation?: number;
  };
}

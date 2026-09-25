export type WorkspaceMode = 'writer' | 'sheets' | 'slides';

export interface DocumentMeta {
  id: string;
  title: string;
  filePath?: string;
  isDirty: boolean;
  lastSaved?: string;
  mode: WorkspaceMode;
}

// SOS Writer Types
export interface WriterDocument {
  meta: DocumentMeta;
  contentHtml: string;
  contentMarkdown: string;
  wordCount: number;
  charCount: number;
  pageCount: number;
  pageSize?: 'a4' | 'letter';
}

// SOS Sheets Types
export interface CellFormatting {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
  textColor?: string;
  bgColor?: string;
  format?: 'general' | 'number' | 'currency' | 'percent' | 'date';
}

export interface CellValue {
  raw: string; // The formula or raw entry, e.g. "=SUM(A1:A5)" or "42"
  computed: string | number; // Evaluated display value
  format?: CellFormatting;
}

export type SheetGrid = Record<string, CellValue>; // Keyed by "A1", "B2", etc.

export interface SheetTab {
  id: string;
  name: string;
  cells: SheetGrid;
  rowCount: number;
  colCount: number;
}

export interface SpreadsheetWorkbook {
  meta: DocumentMeta;
  activeSheetId: string;
  sheets: SheetTab[];
}

// SOS Slides Types
export type SlideElementType = 'title' | 'text' | 'shape' | 'code' | 'image' | 'stat';
export type ShapeVariant = 'rectangle' | 'circle' | 'pill' | 'quote-box';

export interface SlideElement {
  id: string;
  type: SlideElementType;
  x: number; // Percentage 0-100 of slide width
  y: number; // Percentage 0-100 of slide height
  width: number; // Percentage
  height: number; // Percentage
  content: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontColor?: string;
  bgColor?: string;
  borderRadius?: number;
  shapeVariant?: ShapeVariant;
  language?: string; // For code blocks
}

export interface Slide {
  id: string;
  title: string;
  elements: SlideElement[];
  bgColor: string;
  notes?: string;
  layout?: 'title' | 'content' | 'two-column' | 'blank';
}

export interface SlideDeck {
  meta: DocumentMeta;
  slides: Slide[];
  aspectRatio: '16:9' | '4:3';
  theme?: string;
}

export interface SystemMetrics {
  platform: string;
  arch: string;
  memory_used_mb: number;
  total_memory_mb: number;
  cpu_count: number;
  is_offline: boolean;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

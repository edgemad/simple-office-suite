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
export interface DocumentHeading {
  id: string;
  text: string;
  level: number;
}

export interface DocumentPageSetup {
  margin: 'normal' | 'narrow' | 'wide';
  orientation: 'portrait' | 'landscape';
  size: 'letter' | 'a4' | 'legal';
}

export interface WriterDocument {
  meta: DocumentMeta;
  contentHtml: string;
  contentMarkdown: string;
  wordCount: number;
  charCount: number;
  pageCount: number;
  pageSize?: 'a4' | 'letter';
  pageSetup?: DocumentPageSetup;
  columns?: number;
  watermark?: string;
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
  wrap?: boolean;
  border?: 'none' | 'all' | 'outer' | 'top' | 'bottom';
  merged?: string;
  invalid?: boolean;
}

export interface CellValue {
  raw: string; // The formula or raw entry, e.g. "=SUM(A1:A5)" or "42"
  computed: string | number; // Evaluated display value
  format?: CellFormatting;
}

export type SheetGrid = Record<string, CellValue>; // Keyed by "A1", "B2", etc.

export interface SheetChart {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'doughnut';
  title: string;
  range: string;
  labelCol?: number;
  valueCol: number;
  x?: number;
  y?: number;
}

export interface ConditionalFormatRule {
  id: string;
  range: string;
  condition: 'greaterThan' | 'lessThan' | 'equals' | 'contains' | 'notEmpty';
  value: string;
  bgColor: string;
  textColor: string;
}

export interface SheetTab {
  id: string;
  name: string;
  cells: SheetGrid;
  rowCount: number;
  colCount: number;
  charts?: SheetChart[];
  conditionalRules?: ConditionalFormatRule[];
  frozenRows?: number;
  frozenCols?: number;
  validation?: {
    target: string;
    items: string[];
  };
}

export interface SpreadsheetWorkbook {
  meta: DocumentMeta;
  activeSheetId: string;
  sheets: SheetTab[];
}

// SOS Slides Types
export type SlideElementType = 'title' | 'text' | 'shape' | 'code' | 'image' | 'stat' | 'arrow' | 'star' | 'triangle' | 'callout';
export type ShapeVariant = 'rectangle' | 'rounded' | 'circle' | 'pill' | 'quote-box' | 'star' | 'arrow-right' | 'arrow-left' | 'triangle' | 'callout';

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
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  shapeVariant?: ShapeVariant;
  language?: string; // For code blocks
  zIndex?: number;
}

export interface Slide {
  id: string;
  title: string;
  elements: SlideElement[];
  bgColor: string;
  notes?: string;
  layout?: 'title' | 'content' | 'two-column' | 'stat' | 'section-header' | 'blank';
  transition?: 'none' | 'fade' | 'slide' | 'zoom';
  watermark?: string;
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

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  defaultMode: WorkspaceMode;
  autoSaveIntervalMin: number;
  language: string;
  showRuler: boolean;
  showStatusBar: boolean;
  wordDefaultFont: string;
  wordDefaultFontSize: number;
  wordDefaultPageSize: 'a4' | 'letter';
  wordSpellCheck: boolean;
  sheetShowGridlines: boolean;
  sheetCalculationMode: 'auto' | 'manual';
  sheetShowFormulaBar: boolean;
  slideDefaultRatio: '16:9' | '4:3';
  slideDefaultTheme: string;
  aiProvider: 'local' | 'openai' | 'anthropic' | 'ollama';
  aiApiKey: string;
  aiModel: string;
  aiTemperature: number;
}

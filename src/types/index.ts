export type WorkspaceMode = 'writer' | 'sheets' | 'slides' | 'pdf' | 'email' | 'communicator';

export interface DocumentMeta {
  id: string;
  title: string;
  filePath?: string;
  isDirty: boolean;
  lastSaved?: string;
  mode: WorkspaceMode;
}

// SOS Communicator / Teams Types
export type UserPresence = 'online' | 'away' | 'busy' | 'offline';

export interface CommunicatorUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  presence: UserPresence;
  statusMessage?: string;
  isSelf?: boolean;
}

export type ChannelType = 'channel' | 'dm';

export interface ChatAttachment {
  id: string;
  name: string;
  type: 'docx' | 'xlsx' | 'pptx' | 'pdf' | 'image' | 'code';
  size: string;
  url?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderRole?: string;
  content: string;
  timestamp: string;
  reactions?: Record<string, number>;
  attachments?: ChatAttachment[];
  isEncrypted: boolean;
  replyToId?: string;
}

export interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  type: ChannelType;
  unreadCount: number;
  recipientUser?: CommunicatorUser;
  isPrivate?: boolean;
  isEncrypted: boolean;
}

export interface CommunicatorState {
  currentUser: CommunicatorUser | null;
  channels: ChatChannel[];
  activeChannelId: string;
  messages: Record<string, ChatMessage[]>;
  isDetached: boolean;
  activeCall: {
    isInCall: boolean;
    channelName: string;
    isMuted: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    durationSeconds: number;
    participants: CommunicatorUser[];
  } | null;
}


// SOS Mail & Email Types
export type EmailFolder = 'inbox' | 'starred' | 'sent' | 'drafts' | 'archive' | 'trash' | 'junk';

export interface EmailAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  dataUrl?: string;
}

export interface EmailMessage {
  id: string;
  fromName: string;
  fromEmail: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  date: string;
  preview: string;
  bodyHtml: string;
  folder: EmailFolder;
  isUnread: boolean;
  isStarred: boolean;
  labels?: string[];
  attachments?: EmailAttachment[];
}

export interface EmailAccount {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  incomingServer?: string;
  outgoingServer?: string;
}

export interface MailboxState {
  meta: DocumentMeta;
  activeAccount: EmailAccount;
  activeFolder: EmailFolder;
  selectedEmailId: string | null;
  emails: EmailMessage[];
  searchQuery: string;
  filterUnreadOnly: boolean;
}


// SOS PDF & Forms Types
export interface PdfFormField {
  id: string;
  type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'signature' | 'date';
  name: string;
  value: string | boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  options?: string[];
}

export interface PdfDocument {
  meta: DocumentMeta;
  title: string;
  pageCount: number;
  currentPage: number;
  filePath?: string;
  dataUri?: string;
  textContent: string;
  formFields: PdfFormField[];
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
  pdfDefaultZoom: string;
  pdfHighlightFields: boolean;
  aiProvider: 'local' | 'openai' | 'anthropic' | 'ollama';
  aiApiKey: string;
  aiModel: string;
  aiTemperature: number;
  emailSignature?: string;
  emailCheckIntervalMin?: number;
}

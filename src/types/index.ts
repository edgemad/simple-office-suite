export type WorkspaceMode = 'drive' | 'writer' | 'sheets' | 'slides' | 'pdf' | 'forms';

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
  memberIds?: string[];
  isPrivate?: boolean;
  isEncrypted: boolean;
  createdAt?: string;
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
export type EmailFolder = 'inbox' | 'starred' | 'sent' | 'drafts' | 'archive' | 'trash' | 'junk' | string;

export interface EmailAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  dataUrl?: string;
  content?: string;
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
  priority?: 'normal' | 'high' | 'urgent' | 'low';
}

export interface EmailAccount {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  incomingServer?: string;
  incomingPort?: number;
  outgoingServer?: string;
  outgoingPort?: number;
  security?: 'SSL' | 'TLS' | 'STARTTLS' | 'None';
  username?: string;
  password?: string;
  signature?: string;
  autoCheckMinutes?: number;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  organization?: string;
  role?: string;
  phone?: string;
  notes?: string;
  avatarColor?: string;
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
export type EditorMode = 'editing' | 'suggesting' | 'viewing';

export interface CommentReply {
  id: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  timestamp: string;
}

export interface DocumentComment {
  id: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  timestamp: string;
  quotedText?: string;
  resolved: boolean;
  replies: CommentReply[];
  isSuggestion?: boolean;
  suggestedAction?: 'insert' | 'delete' | 'replace';
  suggestedText?: string;
}

export interface DocumentVersion {
  id: string;
  timestamp: string;
  authorName: string;
  name?: string;
  content: string;
  isAutoSave?: boolean;
}

export interface DocumentWatermark {
  enabled: boolean;
  text: string;
  opacity: number;
  angle: number;
  color?: string;
}

export interface DocumentHeaderFooter {
  headerText: string;
  footerText: string;
  showPageNumbers: boolean;
  firstPageDifferent: boolean;
}

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
  comments?: DocumentComment[];
  versions?: DocumentVersion[];
  watermark?: DocumentWatermark;
  headerFooter?: DocumentHeaderFooter;
}

// SOS Sheets Types
export interface CellBorderConfig {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
  color?: string;
  style?: 'solid' | 'dashed' | 'double';
}

export interface CellFormatting {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  wrapText?: 'overflow' | 'wrap' | 'clip';
  rotation?: 'none' | 'tilt_up' | 'tilt_down' | 'vertical' | 'rotate_up' | 'rotate_down';
  textColor?: string;
  bgColor?: string;
  format?: 'general' | 'number' | 'currency' | 'currency_rounded' | 'percent' | 'scientific' | 'accounting' | 'financial' | 'date' | 'time' | 'datetime' | 'duration' | 'text';
  borders?: CellBorderConfig;
}

export type ValidationCriteria = 'list' | 'number' | 'date' | 'text' | 'checkbox';

export interface DataValidationRule {
  id: string;
  range: string;
  criteria: ValidationCriteria;
  allowInvalid: boolean;
  options?: string[];
  min?: number;
  max?: number;
  operator?: 'between' | 'greaterThan' | 'lessThan' | 'equals';
}

export interface MergedRange {
  startCell: string;
  endCell: string;
  rowSpan: number;
  colSpan: number;
}

export interface SheetFilter {
  enabled: boolean;
  range: string;
  colFilters: Record<number, {
    condition?: string;
    conditionValue?: string;
    hiddenValues?: string[];
  }>;
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
  tabColor?: string;
  isHidden?: boolean;
  dataValidation?: DataValidationRule[];
  mergedRanges?: MergedRange[];
  filter?: SheetFilter;
}

export interface SpreadsheetWorkbook {
  meta: DocumentMeta;
  activeSheetId: string;
  sheets: SheetTab[];
  versions?: DocumentVersion[];
}

// SOS Slides Types
export type SlideTransitionType = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'zoom' | 'flip';

export interface SlideTransition {
  type: SlideTransitionType;
  durationSec: number;
}

export interface SlideTableData {
  rows: number;
  cols: number;
  cells: string[][];
  headerBg?: string;
}

export interface SlideChartData {
  chartType: 'bar' | 'column' | 'line' | 'pie';
  title: string;
  labels: string[];
  values: number[];
  colors?: string[];
}

export type SlideElementType = 'title' | 'text' | 'shape' | 'code' | 'image' | 'stat' | 'arrow' | 'star' | 'triangle' | 'callout' | 'table' | 'chart';
export type ShapeVariant = 'rectangle' | 'rounded' | 'circle' | 'pill' | 'quote-box' | 'star' | 'arrow-right' | 'arrow-left' | 'triangle' | 'callout' | 'diamond' | 'banner';

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
  tableData?: SlideTableData;
  chartData?: SlideChartData;
}

export interface Slide {
  id: string;
  title: string;
  elements: SlideElement[];
  bgColor: string;
  notes?: string;
  layout?: 'title' | 'content' | 'two-column' | 'stat' | 'section-header' | 'blank';
  transition?: SlideTransition;
  isHidden?: boolean;
}

export interface SlideDeck {
  meta: DocumentMeta;
  slides: Slide[];
  aspectRatio: '16:9' | '4:3';
  theme?: string;
  versions?: DocumentVersion[];
}

// Team Collaboration & Sharing
export type DocumentRole = 'owner' | 'editor' | 'commenter' | 'viewer';

export interface DocumentCollaborator {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: DocumentRole;
  activeColor: string;
  isOnline: boolean;
  cursorPosition?: string;
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

export type GoogleAccountType = 'personal' | 'workspace';
export type GeminiPlanTier = 'google_one_ai_premium' | 'gemini_advanced' | 'gemini_free' | 'workspace_enterprise';

export interface GoogleAccount {
  id: string;
  email: string;
  name: string;
  accountType: GoogleAccountType; // 'personal' (@gmail.com / Google One) vs 'workspace' (Enterprise / School)
  avatarUrl?: string;
  avatarColor: string;
  isSignedIn: boolean;
  lastSynced?: string;
  driveQuotaUsedMb: number;
  driveQuotaTotalMb: number;
  geminiPlan: GeminiPlanTier;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  clientId?: string;
  clientSecret?: string;
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
  aiProvider: 'gemini' | 'local' | 'openai' | 'anthropic' | 'ollama';
  aiApiKey: string;
  aiModel: string;
  aiTemperature: number;
  emailSignature?: string;
  emailCheckIntervalMin?: number;
}

// Google Forms Types
export type QuestionType =
  | 'short_answer'
  | 'paragraph'
  | 'multiple_choice'
  | 'checkboxes'
  | 'dropdown'
  | 'linear_scale'
  | 'date'
  | 'time';

export interface FormOption {
  id: string;
  text: string;
  isOther?: boolean;
}

export interface FormQuestion {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  options: FormOption[];
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  imageUrl?: string;
  points?: number;
  correctAnswers?: string[];
  feedback?: string;
}

export interface FormSettings {
  isQuiz: boolean;
  defaultPoints: number;
  collectEmail: boolean;
  limitOneResponse: boolean;
  allowResponseEdit: boolean;
  showProgressBar: boolean;
  shuffleQuestions: boolean;
  confirmationMessage: string;
  requireQuestionsByDefault: boolean;
}

export interface FormResponse {
  id: string;
  submittedAt: string;
  respondentEmail?: string;
  score?: number;
  maxScore?: number;
  answers: Record<string, string | string[] | number>;
}

export interface FormDocument {
  meta: DocumentMeta;
  title: string;
  description: string;
  headerColor: string;
  bgColor: string;
  questions: FormQuestion[];
  settings: FormSettings;
  responses: FormResponse[];
  acceptingResponses: boolean;
export interface OpenTab {
  id: string;
  title: string;
  mode: WorkspaceMode;
  isDirty: boolean;
}

// Multi-Cloud & Local Storage Types
export type StorageTarget = 'local' | 'cloud';
export type CloudDriveProvider =
  | 'google_drive'
  | 'onedrive'
  | 'dropbox'
  | 'terabox'
  | 'box'
  | 'pcloud'
  | 'mega'
  | 'webdav'
  | 'local_folder';

export interface CloudStorageAccount {
  id: string;
  provider: CloudDriveProvider;
  providerName: string;
  email: string;
  name: string;
  avatarUrl?: string;
  avatarColor: string;
  isSignedIn: boolean;
  lastSynced?: string;
  quotaUsedMb: number;
  quotaTotalMb: number;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  clientId?: string;
  clientSecret?: string;
  serverUrl?: string;
  folderPath?: string;
}

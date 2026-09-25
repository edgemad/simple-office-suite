import type { EmailMessage, EmailFolder, EmailAccount } from '../types';

export const DEFAULT_ACCOUNTS: EmailAccount[] = [
  {
    id: 'acc_1',
    name: 'Edgar Madeja',
    email: 'edgar.madeja@simpleoffice.local',
    avatar: 'EM',
    incomingServer: 'imap.simpleoffice.local:993',
    outgoingServer: 'smtp.simpleoffice.local:587',
  },
  {
    id: 'acc_2',
    name: 'Work Workspace',
    email: 'edgar@workspace.company.com',
    avatar: 'WW',
    incomingServer: 'imap.company.com:993',
    outgoingServer: 'smtp.company.com:587',
  },
];

export const INITIAL_EMAILS: EmailMessage[] = [
  {
    id: 'mail_1',
    fromName: 'Sarah Jenkins',
    fromEmail: 'sarah.jenkins@acme-corp.com',
    to: ['edgar.madeja@simpleoffice.local'],
    cc: ['finance-team@acme-corp.com'],
    subject: 'Q3 Financial Review & Model Finalization',
    date: 'Today, 2:45 PM',
    preview: 'Hi Edgar, please review the finalized Q3 expenditure and revenue projections before our executive meeting tomorrow...',
    bodyHtml: `
      <p>Hi Edgar,</p>
      <p>I hope you are having a productive week. Attached you will find the updated <strong>Q3 Financial Review spreadsheet</strong> with our consolidated numbers across all regional divisions.</p>
      <p>Key highlights from this quarter:</p>
      <ul>
        <li><strong>Hardware & Devices</strong>: Maintained under budget by 6.2%.</li>
        <li><strong>Research & Prototyping</strong>: Delivered accelerated outcomes with zero cloud overhead.</li>
        <li><strong>Total Net Profit Margin</strong>: Tracking at an exceptional 34.8%.</li>
      </ul>
      <p>Please double-check the formula models in Tab 2 before our final review tomorrow morning.</p>
      <p>Best regards,<br><strong>Sarah Jenkins</strong><br><span style="color:#64748b; font-size:12px;">Chief Financial Officer • Acme Corp</span></p>
    `,
    folder: 'inbox',
    isUnread: true,
    isStarred: true,
    labels: ['Finance', 'High Priority'],
    attachments: [
      { id: 'att_1', name: 'Q3_Financial_Model.xlsx', size: '24.5 KB', type: 'spreadsheet' },
      { id: 'att_2', name: 'Executive_Summary.pdf', size: '1.2 MB', type: 'pdf' },
    ],
  },
  {
    id: 'mail_2',
    fromName: 'Alex Chen',
    fromEmail: 'alex.chen@innovate.tech',
    to: ['edgar.madeja@simpleoffice.local'],
    subject: 'Simple Office Suite - Release 1.0 Milestone',
    date: 'Yesterday, 5:12 PM',
    preview: 'Team, congratulations on successfully packaging the release builds across macOS, Windows, and Linux. Here is the release roadmap...',
    bodyHtml: `
      <p>Hey Edgar,</p>
      <p>Incredible work on reaching the Release 1.0 Milestone for <strong>Simple Office Suite (SOS)</strong>!</p>
      <p>All 5 office modules (Word, Sheet, Slides, PDF, and Mail) are now fully functional and verified across platforms. The lightweight memory footprint (~28 MB) completely outclasses legacy web-based suites.</p>
      <p>Let's coordinate on drafting the changelog announcement later this afternoon.</p>
      <p>Cheers,<br><strong>Alex Chen</strong><br><span style="color:#64748b; font-size:12px;">Lead Software Architect</span></p>
    `,
    folder: 'inbox',
    isUnread: false,
    isStarred: true,
    labels: ['Milestones'],
    attachments: [
      { id: 'att_3', name: 'Release_Notes_v1.0.docx', size: '18.2 KB', type: 'document' },
    ],
  },
  {
    id: 'mail_3',
    fromName: 'Elena Rostova',
    fromEmail: 'elena@privacytrust.org',
    to: ['edgar.madeja@simpleoffice.local'],
    subject: 'Zero-Cloud Offline Privacy Verification & Certificate',
    date: 'Sep 24, 11:30 AM',
    preview: 'We have concluded our static code and runtime packet analysis for Simple Office Suite. Your offline-first architecture complies with all privacy standards...',
    bodyHtml: `
      <p>Dear Edgar,</p>
      <p>We are pleased to inform you that our audit team has finalized the privacy and telemetry evaluation of Simple Office Suite.</p>
      <p><strong>Audit Result: PASSED (100% Zero-Cloud Telemetry)</strong></p>
      <p>No unexpected outbound socket connections or third-party tracking scripts were detected during document editing, formula evaluation, presentation playback, or offline email archiving.</p>
      <p>Thank you for championing user sovereignty and local-first software.</p>
      <p>Warm regards,<br><strong>Elena Rostova</strong><br><span style="color:#64748b; font-size:12px;">Director of Digital Sovereignty • PrivacyTrust Foundation</span></p>
    `,
    folder: 'inbox',
    isUnread: false,
    isStarred: false,
    labels: ['Compliance'],
    attachments: [
      { id: 'att_4', name: 'Privacy_Audit_Certificate.pdf', size: '340 KB', type: 'pdf' },
    ],
  },
  {
    id: 'mail_4',
    fromName: 'Marcus Vance',
    fromEmail: 'marcus.vance@company.com',
    to: ['edgar.madeja@simpleoffice.local'],
    subject: 'Presentation Deck for All-Hands Strategy Call',
    date: 'Sep 23, 9:15 AM',
    preview: 'Attached is the slide deck for next Wednesday’s all-hands meeting. Take a look at the slide transitions and let me know your thoughts...',
    bodyHtml: `
      <p>Hi Edgar,</p>
      <p>Please check out the attached slide deck for our quarterly strategy sync. I’ve incorporated the 16:9 widescreen layout and midnight dark theme.</p>
      <p>Feel free to edit the speaker notes on slide 3 directly.</p>
      <p>Thanks,<br>Marcus</p>
    `,
    folder: 'archive',
    isUnread: false,
    isStarred: false,
    labels: ['Presentations'],
    attachments: [
      { id: 'att_5', name: 'Strategy_All_Hands.pptx', size: '3.4 MB', type: 'presentation' },
    ],
  },
  {
    id: 'mail_5',
    fromName: 'Simple Office Suite Team',
    fromEmail: 'welcome@simpleoffice.local',
    to: ['edgar.madeja@simpleoffice.local'],
    subject: 'Welcome to your Offline-First Office Suite & Mail Client',
    date: 'Sep 20, 8:00 AM',
    preview: 'Welcome to your complete suite! Explore Word documents, Excel spreadsheets, PowerPoint presentations, PDF forms, and integrated Email...',
    bodyHtml: `
      <p>Welcome to <strong>Simple Office Suite (SOS)</strong>!</p>
      <p>You now have a unified, high-performance office suite that works 100% on your device:</p>
      <ul>
        <li><strong>Word</strong>: Full typography, tables, images, and .docx export.</li>
        <li><strong>Sheet</strong>: 50+ calculation formulas (SUM, AVERAGE, COUNT, VLOOKUP, IF) with grid formatting and .xlsx support.</li>
        <li><strong>Slides</strong>: Rich layouts, interactive components, presenter stopwatch, and .pptx export.</li>
        <li><strong>PDF & Forms</strong>: Fillable text boxes, signatures, and document printing.</li>
        <li><strong>Email</strong>: Fast local mail organization, folder management, rich HTML composer, and built-in OnlyOffice AI Assistant.</li>
      </ul>
      <p>Enjoy productivity with zero telemetry and total data control.</p>
    `,
    folder: 'inbox',
    isUnread: false,
    isStarred: true,
    labels: ['Welcome'],
  },
];

const STORAGE_KEY = 'simple_office_emails_v1';

export function loadEmails(): EmailMessage[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [...INITIAL_EMAILS];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveEmails(INITIAL_EMAILS);
      return [...INITIAL_EMAILS];
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse emails from storage:', err);
    return [...INITIAL_EMAILS];
  }
}

export function saveEmails(emails: EmailMessage[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(emails));
  } catch (err) {
    console.error('Failed to save emails:', err);
  }
}

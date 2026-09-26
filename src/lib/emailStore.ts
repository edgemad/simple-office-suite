import type { EmailMessage, EmailAccount } from '../types';

export const EMAIL_DEMO_NOTICE =
  'Demo mailbox: these messages are fictional sample data stored locally. No mail server is contacted and nothing is sent or received.';

export const DEFAULT_ACCOUNTS: EmailAccount[] = [
  {
    id: 'acc_1',
    name: 'Riley Adams',
    email: 'riley.adams@demo.example',
    avatar: 'RA',
    incomingServer: 'not connected (local demo mailbox)',
    outgoingServer: 'not connected (local demo mailbox)',
  },
  {
    id: 'acc_2',
    name: 'Demo Project Group',
    email: 'riley.adams@project-demo.example',
    avatar: 'DP',
    incomingServer: 'not connected (local demo mailbox)',
    outgoingServer: 'not connected (local demo mailbox)',
  },
];

export const INITIAL_EMAILS: EmailMessage[] = [
  {
    id: 'mail_1',
    fromName: 'Casey Morgan',
    fromEmail: 'casey.morgan@northgate-demo.example',
    to: ['riley.adams@demo.example'],
    cc: ['demo-finance@project-demo.example'],
    subject: 'Quarterly Budget Review & Model Finalization',
    date: 'Today, 2:45 PM',
    preview: 'Hi Riley, please review the finalized budget and revenue projections before our review session tomorrow...',
    bodyHtml: `
      <p>Hi Riley,</p>
      <p>Hope your week is going well. Attached is the updated <strong>quarterly budget workbook</strong> with the consolidated numbers for each demo division.</p>
      <p>Highlights from this quarter:</p>
      <ul>
        <li><strong>Equipment</strong>: came in 6.2% under the sample budget.</li>
        <li><strong>Prototyping</strong>: demo milestones delivered on schedule.</li>
        <li><strong>Sample margin</strong>: 34.8% in the sample dataset.</li>
      </ul>
      <p>Please double-check the formulas on the second tab before the review tomorrow morning.</p>
      <p>Best regards,<br><strong>Casey Morgan</strong><br><span style="color:#64748b; font-size:12px;">Sample Finance Lead • Northgate Demo Co.</span></p>
    `,
    folder: 'inbox',
    isUnread: true,
    isStarred: true,
    labels: ['Finance', 'High Priority'],
    attachments: [
      { id: 'att_1', name: 'Sample_Budget_Model.xlsx', size: '24.5 KB', type: 'spreadsheet' },
      { id: 'att_2', name: 'Sample_Executive_Summary.pdf', size: '1.2 MB', type: 'pdf' },
    ],
  },
  {
    id: 'mail_2',
    fromName: 'Devon Patel',
    fromEmail: 'devon.patel@bluepeak-demo.example',
    to: ['riley.adams@demo.example'],
    subject: 'Simple Office Suite 1.0 Demo Release Notes',
    date: 'Yesterday, 5:12 PM',
    preview: 'Team, the demo release builds for macOS, Windows, and Linux are packaged. Here is the sample release roadmap...',
    bodyHtml: `
      <p>Hey Riley,</p>
      <p>Nice work putting the <strong>Simple Office Suite</strong> demo release together.</p>
      <p>All six demo modules (Writer, Sheet, Slides, PDF, Mail, and Communicator) are wired up and run locally on the device. Mail and Communicator are simulated demos with sample data, not real services.</p>
      <p>Let's coordinate on the demo changelog this afternoon.</p>
      <p>Cheers,<br><strong>Devon Patel</strong><br><span style="color:#64748b; font-size:12px;">Sample Software Architect • Bluepeak Demo Studio</span></p>
    `,
    folder: 'inbox',
    isUnread: false,
    isStarred: true,
    labels: ['Milestones'],
    attachments: [
      { id: 'att_3', name: 'Sample_Release_Notes.docx', size: '18.2 KB', type: 'document' },
    ],
  },
  {
    id: 'mail_3',
    fromName: 'Jordan Blake',
    fromEmail: 'jordan.blake@safedata-demo.example',
    to: ['riley.adams@demo.example'],
    subject: 'Documentation Review: Where Your Data Is Stored',
    date: 'Sep 24, 11:30 AM',
    preview: 'We reviewed the sample documentation for the demo app and drafted clearer wording about local storage...',
    bodyHtml: `
      <p>Dear Riley,</p>
      <p>We reviewed the sample documentation for the Simple Office Suite demo app and drafted clearer wording about how data is handled.</p>
      <p><strong>Documentation Result: Updated (sample findings)</strong></p>
      <p>Documents, spreadsheets, and chats are stored unencrypted in the app profile on this device. Cloud requests only happen when a user configures an AI provider and triggers an AI action.</p>
      <p>Thanks for clarifying the demo scope.</p>
      <p>Warm regards,<br><strong>Jordan Blake</strong><br><span style="color:#64748b; font-size:12px;">Sample Documentation Reviewer • SafeData Demo Group</span></p>
    `,
    folder: 'inbox',
    isUnread: false,
    isStarred: false,
    labels: ['Documentation'],
    attachments: [
      { id: 'att_4', name: 'Sample_Review_Notes.pdf', size: '340 KB', type: 'pdf' },
    ],
  },
  {
    id: 'mail_4',
    fromName: 'Sasha Nguyen',
    fromEmail: 'sasha.nguyen@studiolab-demo.example',
    to: ['riley.adams@demo.example'],
    subject: 'Sample Deck for the All-Hands Review',
    date: 'Sep 23, 9:15 AM',
    preview: 'Attached is a sample slide deck for the next all-hands review. Take a look at the layout and let me know your thoughts...',
    bodyHtml: `
      <p>Hi Riley,</p>
      <p>Please check the attached sample deck for the quarterly review. I used the 16:9 layout and the dark theme.</p>
      <p>Feel free to edit the speaker notes on slide 3.</p>
      <p>Thanks,<br>Sasha</p>
    `,
    folder: 'archive',
    isUnread: false,
    isStarred: false,
    labels: ['Presentations'],
    attachments: [
      { id: 'att_5', name: 'Sample_All_Hands_Deck.pptx', size: '3.4 MB', type: 'presentation' },
    ],
  },
  {
    id: 'mail_5',
    fromName: 'Simple Office Suite Demo',
    fromEmail: 'welcome@demo.example',
    to: ['riley.adams@demo.example'],
    subject: 'Welcome to the Simple Office Suite Demo App',
    date: 'Sep 20, 8:00 AM',
    preview: 'Welcome to the demo suite: explore Writer documents, Sheet workbooks, Slides decks, PDF forms, Mail, and Communicator...',
    bodyHtml: `
      <p>Welcome to the <strong>Simple Office Suite</strong> demo app!</p>
      <p>Everything here runs on this device. Two modules are simulated demos with sample data:</p>
      <ul>
        <li><strong>Mail</strong>: a local sample mailbox, folders, composer, and simulated attachments. It does not connect to any mail server.</li>
        <li><strong>Communicator</strong>: a local sample chat with channels, direct messages, and a simulated call screen. There is no real messaging service or call.</li>
      </ul>
      <p>Your documents, settings, and API keys are stored unencrypted in the app profile on this device. A cloud AI provider only receives the text you send when you configure one and run an AI action.</p>
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

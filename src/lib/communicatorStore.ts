import type { CommunicatorUser, ChatChannel, ChatMessage } from '../types';

export const COMMUNICATOR_DEMO_NOTICE =
  'Demo chat: all channels, people, presence, attachments, and calls are simulated locally. No messages leave this device and no call is placed.';

export const TEAM_USERS: CommunicatorUser[] = [
  {
    id: 'user_devon',
    name: 'Devon Patel',
    email: 'devon.patel@bluepeak-demo.example',
    avatar: 'DP',
    role: 'Sample Software Architect',
    presence: 'online',
    statusMessage: 'Packaging the demo release builds',
  },
  {
    id: 'user_casey',
    name: 'Casey Morgan',
    email: 'casey.morgan@northgate-demo.example',
    avatar: 'CM',
    role: 'Sample Finance Lead',
    presence: 'online',
    statusMessage: 'Reviewing the sample budget workbook in Sheet',
  },
  {
    id: 'user_jordan',
    name: 'Jordan Blake',
    email: 'jordan.blake@safedata-demo.example',
    avatar: 'JB',
    role: 'Sample Documentation Reviewer',
    presence: 'away',
    statusMessage: 'Rewriting the local-storage notes',
  },
  {
    id: 'user_sasha',
    name: 'Sasha Nguyen',
    email: 'sasha.nguyen@studiolab-demo.example',
    avatar: 'SN',
    role: 'Sample Product Designer',
    presence: 'busy',
    statusMessage: 'In a sample design review (do not disturb)',
  },
  {
    id: 'user_ai',
    name: 'Suite AI Assistant',
    email: 'ai.assistant@demo.example',
    avatar: 'AI',
    role: 'Built-in Assistant',
    presence: 'online',
    statusMessage: 'Template assistant, or the model you configure',
  },
];

export const INITIAL_CHANNELS: ChatChannel[] = [
  {
    id: 'chan_general',
    name: 'general',
    description: 'Sample announcements and demo workspace chatter',
    type: 'channel',
    unreadCount: 0,
    isEncrypted: false,
  },
  {
    id: 'chan_engineering',
    name: 'engineering',
    description: 'Demo build packaging, the Tauri shell, and performance notes',
    type: 'channel',
    unreadCount: 2,
    isEncrypted: false,
  },
  {
    id: 'chan_product_design',
    name: 'product-design',
    description: 'Suite dark ribbon layout, spacing, and typography',
    type: 'channel',
    unreadCount: 0,
    isEncrypted: false,
  },
  {
    id: 'chan_leadership',
    name: 'leadership-sync',
    description: 'Sample roadmap, budget walkthroughs, and milestone notes',
    type: 'channel',
    unreadCount: 1,
    isPrivate: true,
    isEncrypted: false,
  },
  {
    id: 'dm_devon',
    name: 'Devon Patel',
    type: 'dm',
    unreadCount: 1,
    recipientUser: TEAM_USERS[0],
    isEncrypted: false,
  },
  {
    id: 'dm_casey',
    name: 'Casey Morgan',
    type: 'dm',
    unreadCount: 0,
    recipientUser: TEAM_USERS[1],
    isEncrypted: false,
  },
  {
    id: 'dm_jordan',
    name: 'Jordan Blake',
    type: 'dm',
    unreadCount: 0,
    recipientUser: TEAM_USERS[2],
    isEncrypted: false,
  },
  {
    id: 'dm_ai',
    name: 'Suite AI Assistant',
    type: 'dm',
    unreadCount: 0,
    recipientUser: TEAM_USERS[4],
    isEncrypted: false,
  },
];

export const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  chan_general: [
    {
      id: 'msg_g1',
      senderId: 'user_devon',
      senderName: 'Devon Patel',
      senderAvatar: 'DP',
      senderRole: 'Sample Software Architect',
      content: 'Welcome to the sample workspace in Simple Office Suite. Everything you see here is demo data stored on this device.',
      timestamp: 'Today at 10:15 AM',
      isEncrypted: false,
      reactions: { '🚀': 4, '👍': 3 },
    },
    {
      id: 'msg_g2',
      senderId: 'user_casey',
      senderName: 'Casey Morgan',
      senderAvatar: 'CM',
      senderRole: 'Sample Finance Lead',
      content: 'I like how light it is. The sample chat can be detached into its own window while I keep the demo workbook open.',
      timestamp: 'Today at 10:20 AM',
      isEncrypted: false,
      reactions: { '❤️': 2 },
    },
    {
      id: 'msg_g3',
      senderId: 'user_jordan',
      senderName: 'Jordan Blake',
      senderAvatar: 'JB',
      senderRole: 'Sample Documentation Reviewer',
      content: 'Reminder for the demo: this chat is not encrypted. Messages are stored as plain text in the app profile, and presence is just sample data.',
      timestamp: 'Today at 10:32 AM',
      isEncrypted: false,
      reactions: { '📝': 5 },
    },
  ],
  chan_engineering: [
    {
      id: 'msg_e1',
      senderId: 'user_devon',
      senderName: 'Devon Patel',
      senderAvatar: 'DP',
      senderRole: 'Sample Software Architect',
      content: 'Sample packaging notes: the desktop build produces a macOS `.app` bundle, a Windows NSIS installer, and Debian `.deb` packages.',
      timestamp: 'Today at 11:05 AM',
      isEncrypted: false,
      reactions: { '🎉': 4 },
      attachments: [
        { id: 'att_c1', name: 'Simple-Office-Suite-v1.0.0.deb', type: 'code', size: '132 KB' },
      ],
    },
    {
      id: 'msg_e2',
      senderId: 'user_devon',
      senderName: 'Devon Patel',
      senderAvatar: 'DP',
      senderRole: 'Sample Software Architect',
      content: 'The sample attachment above is a placeholder entry. Nothing is uploaded, and the buttons only switch the active workspace.',
      timestamp: 'Today at 11:12 AM',
      isEncrypted: false,
      reactions: { '⚡': 3 },
    },
  ],
  chan_product_design: [
    {
      id: 'msg_pd1',
      senderId: 'user_sasha',
      senderName: 'Sasha Nguyen',
      senderAvatar: 'SN',
      senderRole: 'Sample Product Designer',
      content: 'The dark ribbon tabs look consistent across Writer, Sheet, Slides, PDF, Mail, and Communicator. Accent colors make switching intuitive.',
      timestamp: 'Yesterday at 4:45 PM',
      isEncrypted: false,
      reactions: { '🎨': 3 },
    },
  ],
  chan_leadership: [
    {
      id: 'msg_l1',
      senderId: 'user_casey',
      senderName: 'Casey Morgan',
      senderAvatar: 'CM',
      senderRole: 'Sample Finance Lead',
      content: 'Sharing the sample budget workbook for the demo review. It is a fictional file used to show the attachment UI.',
      timestamp: 'Today at 9:00 AM',
      isEncrypted: false,
      attachments: [
        { id: 'att_l1', name: 'Sample_Budget_Model.xlsx', type: 'xlsx', size: '24.5 KB' },
      ],
    },
  ],
  dm_devon: [
    {
      id: 'msg_dma1',
      senderId: 'user_devon',
      senderName: 'Devon Patel',
      senderAvatar: 'DP',
      senderRole: 'Sample Software Architect',
      content: 'Hey Riley! The demo chat can be opened in its own window from the top-right detach button.',
      timestamp: 'Today at 11:30 AM',
      isEncrypted: false,
      reactions: { '👍': 1 },
    },
    {
      id: 'msg_dma2',
      senderId: 'user_devon',
      senderName: 'Devon Patel',
      senderAvatar: 'DP',
      senderRole: 'Sample Software Architect',
      content: 'The profile dialog accepts any address you type. It only renames the local demo identity, no account is created or contacted.',
      timestamp: 'Today at 11:32 AM',
      isEncrypted: false,
    },
  ],
  dm_casey: [
    {
      id: 'msg_dms1',
      senderId: 'user_casey',
      senderName: 'Casey Morgan',
      senderAvatar: 'CM',
      senderRole: 'Sample Finance Lead',
      content: 'Hi Riley, did you check the sample formula in cell D5? `=SUM(D2:D4)` evaluates the way we expect.',
      timestamp: 'Yesterday at 3:15 PM',
      isEncrypted: false,
    },
  ],
  dm_jordan: [
    {
      id: 'msg_dme1',
      senderId: 'user_jordan',
      senderName: 'Jordan Blake',
      senderAvatar: 'JB',
      senderRole: 'Sample Documentation Reviewer',
      content: 'I updated the sample welcome notes: the demo clearly says where data is stored and which features are simulated.',
      timestamp: 'Sep 24, 2:00 PM',
      isEncrypted: false,
    },
  ],
  dm_ai: [
    {
      id: 'msg_dmai1',
      senderId: 'user_ai',
      senderName: 'Suite AI Assistant',
      senderAvatar: 'AI',
      senderRole: 'Built-in Assistant',
      content: 'Hello Riley! I am the assistant inside the demo suite. Without a configured model I return templates, for example:\n• "Draft meeting minutes for the demo release"\n• "Summarize our latest engineering updates"\n• "Generate a follow-up checklist"\n\nConfigure a provider in Settings > AI Assistant to send real prompts to a model.',
      timestamp: 'Today at 8:00 AM',
      isEncrypted: false,
    },
  ],
};

const COMMUNICATOR_STORAGE_KEY = 'simple_office_communicator_v1';
const COMMUNICATOR_USER_KEY = 'simple_office_communicator_user_v1';

function buildDefaultSelfUser(): CommunicatorUser {
  return {
    id: 'user_self',
    name: 'Riley Adams',
    email: 'riley.adams@demo.example',
    avatar: 'RA',
    role: 'Demo User',
    presence: 'online',
    statusMessage: 'Working in the Simple Office Suite demo',
    isSelf: true,
  };
}

export function loadCurrentCommunicatorUser(): CommunicatorUser {
  if (typeof window === 'undefined' || !window.localStorage) {
    return buildDefaultSelfUser();
  }

  try {
    const raw = localStorage.getItem(COMMUNICATOR_USER_KEY);
    if (!raw) {
      const defaultUser = buildDefaultSelfUser();
      saveCurrentCommunicatorUser(defaultUser);
      return defaultUser;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse communicator user:', err);
    return buildDefaultSelfUser();
  }
}

export function saveCurrentCommunicatorUser(user: CommunicatorUser): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(COMMUNICATOR_USER_KEY, JSON.stringify(user));
  } catch (err) {
    console.error('Failed to save communicator user:', err);
  }
}

export function loadCommunicatorMessages(): Record<string, ChatMessage[]> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...INITIAL_MESSAGES };
  }

  try {
    const raw = localStorage.getItem(COMMUNICATOR_STORAGE_KEY);
    if (!raw) {
      saveCommunicatorMessages(INITIAL_MESSAGES);
      return { ...INITIAL_MESSAGES };
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse communicator messages:', err);
    return { ...INITIAL_MESSAGES };
  }
}

export function saveCommunicatorMessages(messages: Record<string, ChatMessage[]>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(COMMUNICATOR_STORAGE_KEY, JSON.stringify(messages));
  } catch (err) {
    console.error('Failed to save communicator messages:', err);
  }
}

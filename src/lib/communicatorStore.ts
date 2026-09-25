import type { CommunicatorUser, ChatChannel, ChatMessage } from '../types';

export const TEAM_USERS: CommunicatorUser[] = [
  {
    id: 'user_alex',
    name: 'Alex Chen',
    email: 'alex.chen@innovate.tech',
    avatar: 'AC',
    role: 'Lead Architect',
    presence: 'online',
    statusMessage: 'Optimizing Tauri 2.0 release builds',
  },
  {
    id: 'user_sarah',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@acme-corp.com',
    avatar: 'SJ',
    role: 'Chief Financial Officer',
    presence: 'online',
    statusMessage: 'Reviewing Q3 Financial Model in Sheets',
  },
  {
    id: 'user_elena',
    name: 'Elena Rostova',
    email: 'elena@privacytrust.org',
    avatar: 'ER',
    role: 'Security & Compliance',
    presence: 'away',
    statusMessage: 'Auditing AES-256-GCM local storage',
  },
  {
    id: 'user_marcus',
    name: 'Marcus Vance',
    email: 'marcus.vance@company.com',
    avatar: 'MV',
    role: 'Head of Product Design',
    presence: 'busy',
    statusMessage: 'In presentation design review (Do not disturb)',
  },
  {
    id: 'user_ai',
    name: 'OnlyOffice AI Copilot',
    email: 'ai.copilot@simpleoffice.local',
    avatar: 'AI',
    role: 'Intelligent Office Bot',
    presence: 'online',
    statusMessage: 'Ready to summarize, draft, or calculate',
  },
];

export const INITIAL_CHANNELS: ChatChannel[] = [
  {
    id: 'chan_general',
    name: 'general',
    description: 'General office chatter, announcements, and suite updates',
    type: 'channel',
    unreadCount: 0,
    isEncrypted: true,
  },
  {
    id: 'chan_engineering',
    name: 'engineering',
    description: 'Cross-platform builds, Tauri 2.0 Rust core, and performance',
    type: 'channel',
    unreadCount: 2,
    isEncrypted: true,
  },
  {
    id: 'chan_product_design',
    name: 'product-design',
    description: 'OnlyOffice dark ribbon UI, layout specs, and typography',
    type: 'channel',
    unreadCount: 0,
    isEncrypted: true,
  },
  {
    id: 'chan_leadership',
    name: 'leadership-sync',
    description: 'Executive roadmap, budget projections, and milestone sign-offs',
    type: 'channel',
    unreadCount: 1,
    isPrivate: true,
    isEncrypted: true,
  },
  // Direct Messages
  {
    id: 'dm_alex',
    name: 'Alex Chen',
    type: 'dm',
    unreadCount: 1,
    recipientUser: TEAM_USERS[0],
    isEncrypted: true,
  },
  {
    id: 'dm_sarah',
    name: 'Sarah Jenkins',
    type: 'dm',
    unreadCount: 0,
    recipientUser: TEAM_USERS[1],
    isEncrypted: true,
  },
  {
    id: 'dm_elena',
    name: 'Elena Rostova',
    type: 'dm',
    unreadCount: 0,
    recipientUser: TEAM_USERS[2],
    isEncrypted: true,
  },
  {
    id: 'dm_ai',
    name: 'OnlyOffice AI Copilot',
    type: 'dm',
    unreadCount: 0,
    recipientUser: TEAM_USERS[4],
    isEncrypted: true,
  },
];

export const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  chan_general: [
    {
      id: 'msg_g1',
      senderId: 'user_alex',
      senderName: 'Alex Chen',
      senderAvatar: 'AC',
      senderRole: 'Lead Architect',
      content: 'Welcome everyone to the new Simple Office Communicator! 🚀 It is built with zero cloud dependencies and end-to-end local encryption.',
      timestamp: 'Today at 10:15 AM',
      isEncrypted: true,
      reactions: { '🚀': 4, '👍': 3 },
    },
    {
      id: 'msg_g2',
      senderId: 'user_sarah',
      senderName: 'Sarah Jenkins',
      senderAvatar: 'SJ',
      senderRole: 'Chief Financial Officer',
      content: 'I love how lightweight it is. It detached onto my second monitor seamlessly while I keep the financial sheets open.',
      timestamp: 'Today at 10:20 AM',
      isEncrypted: true,
      reactions: { '❤️': 2 },
    },
    {
      id: 'msg_g3',
      senderId: 'user_elena',
      senderName: 'Elena Rostova',
      senderAvatar: 'ER',
      senderRole: 'Security & Compliance',
      content: 'Confirming that all channel and DM payloads are guarded with AES-256-GCM. No external telemetry or message logging.',
      timestamp: 'Today at 10:32 AM',
      isEncrypted: true,
      reactions: { '🛡️': 5 },
    },
  ],
  chan_engineering: [
    {
      id: 'msg_e1',
      senderId: 'user_alex',
      senderName: 'Alex Chen',
      senderAvatar: 'AC',
      senderRole: 'Lead Architect',
      content: 'Cross-platform packaging is complete! macOS `.app` bundle, Windows NSIS installer, and Debian `.deb` packages are generated in `dist-installer/`.',
      timestamp: 'Today at 11:05 AM',
      isEncrypted: true,
      reactions: { '🎉': 4 },
      attachments: [
        { id: 'att_c1', name: 'Simple-Office-Suite-v1.0.0.deb', type: 'code', size: '132 KB' },
      ],
    },
    {
      id: 'msg_e2',
      senderId: 'user_alex',
      senderName: 'Alex Chen',
      senderAvatar: 'AC',
      senderRole: 'Lead Architect',
      content: 'Memory usage remains under 28 MB across all 6 applications. Feel free to stress-test large documents.',
      timestamp: 'Today at 11:12 AM',
      isEncrypted: true,
      reactions: { '⚡': 3 },
    },
  ],
  chan_product_design: [
    {
      id: 'msg_pd1',
      senderId: 'user_marcus',
      senderName: 'Marcus Vance',
      senderAvatar: 'MV',
      senderRole: 'Head of Product Design',
      content: 'The OnlyOffice dark ribbon tabs look incredible across Word, Sheet, Slides, PDF, and Mail. Accent color indicators make switching intuitive.',
      timestamp: 'Yesterday at 4:45 PM',
      isEncrypted: true,
      reactions: { '🎨': 3 },
    },
  ],
  chan_leadership: [
    {
      id: 'msg_l1',
      senderId: 'user_sarah',
      senderName: 'Sarah Jenkins',
      senderAvatar: 'SJ',
      senderRole: 'Chief Financial Officer',
      content: 'Attaching the finalized Q3 expenditure report for review before tomorrow morning’s board call.',
      timestamp: 'Today at 9:00 AM',
      isEncrypted: true,
      attachments: [
        { id: 'att_l1', name: 'Q3_Financial_Model.xlsx', type: 'xlsx', size: '24.5 KB' },
      ],
    },
  ],
  dm_alex: [
    {
      id: 'msg_dma1',
      senderId: 'user_alex',
      senderName: 'Alex Chen',
      senderAvatar: 'AC',
      senderRole: 'Lead Architect',
      content: 'Hey Edgar! Communicator can now be popped out into an independent standalone window using the top-right Detach button.',
      timestamp: 'Today at 11:30 AM',
      isEncrypted: true,
      reactions: { '👍': 1 },
    },
    {
      id: 'msg_dma2',
      senderId: 'user_alex',
      senderName: 'Alex Chen',
      senderAvatar: 'AC',
      senderRole: 'Lead Architect',
      content: 'You can also log in with any company email or personal email, and it will immediately configure your workspace.',
      timestamp: 'Today at 11:32 AM',
      isEncrypted: true,
    },
  ],
  dm_sarah: [
    {
      id: 'msg_dms1',
      senderId: 'user_sarah',
      senderName: 'Sarah Jenkins',
      senderAvatar: 'SJ',
      senderRole: 'Chief Financial Officer',
      content: 'Hi Edgar, did you verify the formula in cell D5 on the Budget 2026 sheet? `=SUM(D2:D4)` looks clean.',
      timestamp: 'Yesterday at 3:15 PM',
      isEncrypted: true,
    },
  ],
  dm_elena: [
    {
      id: 'msg_dme1',
      senderId: 'user_elena',
      senderName: 'Elena Rostova',
      senderAvatar: 'ER',
      senderRole: 'Security & Compliance',
      content: 'The zero-knowledge certificate has been generated and is attached to the welcome email. Communicator passed all privacy checks.',
      timestamp: 'Sep 24, 2:00 PM',
      isEncrypted: true,
    },
  ],
  dm_ai: [
    {
      id: 'msg_dmai1',
      senderId: 'user_ai',
      senderName: 'OnlyOffice AI Copilot',
      senderAvatar: 'AI',
      senderRole: 'Intelligent Office Bot',
      content: 'Hello Edgar! I am your embedded team assistant. Ask me anything like:\n• "Draft meeting minutes for the 1.0 release"\n• "Summarize our latest engineering updates"\n• "Generate a follow-up checklist"',
      timestamp: 'Today at 8:00 AM',
      isEncrypted: true,
    },
  ],
};

const COMMUNICATOR_STORAGE_KEY = 'simple_office_communicator_v1';
const COMMUNICATOR_USER_KEY = 'simple_office_communicator_user_v1';

export function loadCurrentCommunicatorUser(): CommunicatorUser {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      id: 'user_self',
      name: 'Edgar Madeja',
      email: 'edgar.madeja@simpleoffice.local',
      avatar: 'EM',
      role: 'Software Engineer',
      presence: 'online',
      statusMessage: 'Working in Simple Office Suite',
      isSelf: true,
    };
  }

  try {
    const raw = localStorage.getItem(COMMUNICATOR_USER_KEY);
    if (!raw) {
      const defaultUser: CommunicatorUser = {
        id: 'user_self',
        name: 'Edgar Madeja',
        email: 'edgar.madeja@simpleoffice.local',
        avatar: 'EM',
        role: 'Software Engineer',
        presence: 'online',
        statusMessage: 'Working in Simple Office Suite',
        isSelf: true,
      };
      saveCurrentCommunicatorUser(defaultUser);
      return defaultUser;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse communicator user:', err);
    return {
      id: 'user_self',
      name: 'Edgar Madeja',
      email: 'edgar.madeja@simpleoffice.local',
      avatar: 'EM',
      role: 'Software Engineer',
      presence: 'online',
      isSelf: true,
    };
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

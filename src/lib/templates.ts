import type { WorkspaceMode } from '../types';

export interface OfficeTemplate {
  id: string;
  title: string;
  description: string;
  mode: WorkspaceMode;
  category: string;
  content: any; // HTML string for writer, workbook object for sheets, slide deck for slides
}

export const WRITER_TEMPLATES: OfficeTemplate[] = [
  {
    id: 'writer_blank',
    title: 'Blank Document',
    description: 'Start fresh with a clean page',
    mode: 'writer',
    category: 'General',
    content: '<p>Start typing your document here...</p>'
  },
  {
    id: 'writer_proposal',
    title: 'Project Proposal',
    description: 'Comprehensive project plan with executive summary, deliverables, and timeline',
    mode: 'writer',
    category: 'Business',
    content: `
<h1>Project Proposal & Strategic Plan</h1>
<p class="text-slate-500">Prepared by: Project Leadership Team • Date: ${new Date().toLocaleDateString()}</p>
<hr/>
<h2>1. Executive Summary</h2>
<p>This proposal outlines the strategic objectives, deliverables, and implementation timeline for the upcoming corporate initiative. Our primary goal is to enhance team efficiency and deliver measurable business value through modern productivity tools.</p>

<h2>2. Core Objectives & Milestones</h2>
<ul>
  <li><strong>Efficiency Enhancement:</strong> Reduce project turnaround time by 35% through centralized documentation.</li>
  <li><strong>Data Integrity:</strong> Implement automated data validation and audit logging across all operational spreadsheets.</li>
  <li><strong>Collaborative Communication:</strong> Unify team discussions and document sharing in a single private offline workspace.</li>
</ul>

<h2>3. Project Scope & Deliverables</h2>
<table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr style="background-color: #f1f5f9;">
      <th style="text-align: left;">Phase</th>
      <th style="text-align: left;">Milestone</th>
      <th style="text-align: left;">Owner</th>
      <th style="text-align: left;">Target Date</th>
      <th style="text-align: left;">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Phase 1</td>
      <td>Requirements Analysis & Architecture</td>
      <td>Engineering Lead</td>
      <td>Week 2</td>
      <td>Completed</td>
    </tr>
    <tr>
      <td>Phase 2</td>
      <td>Core Implementation & Feature Integration</td>
      <td>Product Team</td>
      <td>Week 5</td>
      <td>In Progress</td>
    </tr>
    <tr>
      <td>Phase 3</td>
      <td>Quality Assurance & Security Audit</td>
      <td>QA Team</td>
      <td>Week 7</td>
      <td>Planned</td>
    </tr>
    <tr>
      <td>Phase 4</td>
      <td>Global Rollout & User Training</td>
      <td>Operations</td>
      <td>Week 9</td>
      <td>Planned</td>
    </tr>
  </tbody>
</table>

<h2>4. Budget & Resource Allocation</h2>
<p>The estimated investment required for licensing, hardware infrastructure, and team onboarding is detailed in the accompanying financial model.</p>
<blockquote>"Excellence is not an act, but a habit. Consistent productivity requires intuitive tools."</blockquote>
    `
  },
  {
    id: 'writer_minutes',
    title: 'Meeting Minutes & Action Items',
    description: 'Record attendees, agenda topics, discussion notes, and assigned action items',
    mode: 'writer',
    category: 'Meetings',
    content: `
<h1>Team Meeting Minutes</h1>
<p><strong>Meeting Topic:</strong> Quarterly Sprint Planning & Product Alignment<br/>
<strong>Date & Time:</strong> ${new Date().toLocaleDateString()} at 10:00 AM<br/>
<strong>Attendees:</strong> Sarah Lin, Michael Chang, Elena Rostova, David Kim</p>
<hr/>
<h2>1. Agenda Topics</h2>
<ol>
  <li>Review of Previous Sprint Outcomes</li>
  <li>Priority Roadmap for Q3 Deliverables</li>
  <li>Cross-Departmental Blockers & Resource Constraints</li>
  <li>Next Steps & Ownership</li>
</ol>

<h2>2. Key Discussions</h2>
<p>The team reviewed key performance metrics from the past cycle. Cross-platform file compatibility was identified as a critical success factor for enterprise client onboarding.</p>

<h2>3. Action Items</h2>
<table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr style="background-color: #f1f5f9;">
      <th style="text-align: left;">Task Description</th>
      <th style="text-align: left;">Assignee</th>
      <th style="text-align: left;">Due Date</th>
      <th style="text-align: left;">Priority</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Finalize OpenXML export engine documentation</td>
      <td>David Kim</td>
      <td>Friday</td>
      <td>High</td>
    </tr>
    <tr>
      <td>Review security compliance benchmarks</td>
      <td>Elena Rostova</td>
      <td>Next Tuesday</td>
      <td>Medium</td>
    </tr>
    <tr>
      <td>Publish release candidate packages</td>
      <td>Sarah Lin</td>
      <td>Next Thursday</td>
      <td>High</td>
    </tr>
  </tbody>
</table>
    `
  },
  {
    id: 'writer_resume',
    title: 'Executive Resume / CV',
    description: 'Clean, professional curriculum vitae with structured career sections',
    mode: 'writer',
    category: 'Personal',
    content: `
<h1>ALEXANDER J. VANCE</h1>
<p>Senior Technology Director • San Francisco, CA • alex.vance@example.com • (555) 019-2834</p>
<hr/>
<h2>Professional Summary</h2>
<p>Accomplished technology leader with over 12 years of experience building mission-critical enterprise desktop applications, scalable software architectures, and high-performing engineering teams.</p>

<h2>Core Competencies</h2>
<ul>
  <li>Full-Lifecycle Application Development & Architecture</li>
  <li>Cross-Platform Desktop Engineering (Rust, TypeScript, Tauri, Web Technologies)</li>
  <li>Enterprise Data Security & Offline-First Resiliency</li>
  <li>Agile Team Leadership & Technical Strategy</li>
</ul>

<h2>Professional Experience</h2>
<p><strong>Lead Solutions Architect</strong> — Vertex Innovations (2020 – Present)</p>
<ul>
  <li>Spearheaded development of high-performance desktop productivity suite used by 150,000+ active enterprise professionals.</li>
  <li>Reduced application memory footprint by 45% through native Rust system integrations and optimized webview rendering.</li>
</ul>

<p><strong>Senior Software Engineer</strong> — Global Dynamics (2016 – 2020)</p>
<ul>
  <li>Engineered high-throughput spreadsheet calculation engine supporting 50+ complex mathematical and financial formulas.</li>
  <li>Mentored a team of 14 junior and mid-level software developers.</li>
</ul>

<h2>Education</h2>
<p><strong>Bachelor of Science in Computer Science</strong> — Stanford University (Class of 2015)</p>
    `
  }
];

export const SHEETS_TEMPLATES: OfficeTemplate[] = [
  {
    id: 'sheets_blank',
    title: 'Blank Spreadsheet',
    description: 'Clean grid ready for your data and calculations',
    mode: 'sheets',
    category: 'General',
    content: {
      cells: {}
    }
  },
  {
    id: 'sheets_budget',
    title: 'Monthly Budget & Expenses',
    description: 'Track income, fixed expenses, discretionary spending, and net balance',
    mode: 'sheets',
    category: 'Finance',
    content: {
      cells: {
        'A1': { raw: 'MONTHLY BUDGET TRACKER', format: { bold: true, fontSize: 13, textColor: '#047857' } },
        'A3': { raw: 'INCOME SOURCES', format: { bold: true, bgColor: '#dcfce7' } },
        'B3': { raw: 'AMOUNT ($)', format: { bold: true, bgColor: '#dcfce7', align: 'right' } },
        'A4': { raw: 'Primary Salary' },
        'B4': { raw: '6500', format: { format: 'currency', align: 'right' } },
        'A5': { raw: 'Freelance Consulting' },
        'B5': { raw: '1200', format: { format: 'currency', align: 'right' } },
        'A6': { raw: 'Investment Dividends' },
        'B6': { raw: '350', format: { format: 'currency', align: 'right' } },
        'A7': { raw: 'TOTAL INCOME', format: { bold: true } },
        'B7': { raw: '=SUM(B4:B6)', format: { bold: true, format: 'currency', align: 'right' } },

        'A9': { raw: 'MONTHLY EXPENSES', format: { bold: true, bgColor: '#fee2e2' } },
        'B9': { raw: 'AMOUNT ($)', format: { bold: true, bgColor: '#fee2e2', align: 'right' } },
        'A10': { raw: 'Housing / Mortgage' },
        'B10': { raw: '2400', format: { format: 'currency', align: 'right' } },
        'A11': { raw: 'Utilities & Internet' },
        'B11': { raw: '320', format: { format: 'currency', align: 'right' } },
        'A12': { raw: 'Groceries & Dining' },
        'B12': { raw: '750', format: { format: 'currency', align: 'right' } },
        'A13': { raw: 'Healthcare & Insurance' },
        'B13': { raw: '420', format: { format: 'currency', align: 'right' } },
        'A14': { raw: 'Transportation' },
        'B14': { raw: '280', format: { format: 'currency', align: 'right' } },
        'A15': { raw: 'TOTAL EXPENSES', format: { bold: true } },
        'B15': { raw: '=SUM(B10:B14)', format: { bold: true, format: 'currency', align: 'right' } },

        'A17': { raw: 'NET CASH FLOW', format: { bold: true, bgColor: '#fef08a' } },
        'B17': { raw: '=B7-B15', format: { bold: true, format: 'currency', align: 'right', bgColor: '#fef08a' } },
      }
    }
  },
  {
    id: 'sheets_invoice',
    title: 'Professional Invoice & Receipt',
    description: 'Itemized billing with tax calculation, discounts, and total due',
    mode: 'sheets',
    category: 'Business',
    content: {
      cells: {
        'A1': { raw: 'INVOICE #INV-2026-088', format: { bold: true, fontSize: 14, textColor: '#1e3a8a' } },
        'A2': { raw: 'Issue Date: 2026-09-25' },
        'A3': { raw: 'Due Date: 2026-10-25' },

        'A5': { raw: 'Item Description', format: { bold: true, bgColor: '#e2e8f0' } },
        'B5': { raw: 'Hours / Qty', format: { bold: true, bgColor: '#e2e8f0', align: 'right' } },
        'C5': { raw: 'Rate ($)', format: { bold: true, bgColor: '#e2e8f0', align: 'right' } },
        'D5': { raw: 'Total ($)', format: { bold: true, bgColor: '#e2e8f0', align: 'right' } },

        'A6': { raw: 'Custom Software Architecture Design' },
        'B6': { raw: '40', format: { align: 'right' } },
        'C6': { raw: '125', format: { format: 'currency', align: 'right' } },
        'D6': { raw: '=B6*C6', format: { format: 'currency', align: 'right' } },

        'A7': { raw: 'Frontend Component Implementation' },
        'B7': { raw: '60', format: { align: 'right' } },
        'C7': { raw: '95', format: { format: 'currency', align: 'right' } },
        'D7': { raw: '=B7*C7', format: { format: 'currency', align: 'right' } },

        'A8': { raw: 'Security Audit & Offline Testing' },
        'B8': { raw: '20', format: { align: 'right' } },
        'C8': { raw: '140', format: { format: 'currency', align: 'right' } },
        'D8': { raw: '=B8*C8', format: { format: 'currency', align: 'right' } },

        'C10': { raw: 'Subtotal:', format: { bold: true, align: 'right' } },
        'D10': { raw: '=SUM(D6:D8)', format: { bold: true, format: 'currency', align: 'right' } },

        'C11': { raw: 'Sales Tax (8%):', format: { align: 'right' } },
        'D11': { raw: '=D10*0.08', format: { format: 'currency', align: 'right' } },

        'C12': { raw: 'TOTAL DUE:', format: { bold: true, bgColor: '#dbeafe', align: 'right' } },
        'D12': { raw: '=D10+D11', format: { bold: true, format: 'currency', align: 'right', bgColor: '#dbeafe' } }
      }
    }
  }
];

export const SLIDES_TEMPLATES: OfficeTemplate[] = [
  {
    id: 'slides_pitch',
    title: 'Startup Investor Pitch Deck',
    description: 'Problem, solution, market opportunity, business model, and team presentation',
    mode: 'slides',
    category: 'Startup',
    content: [
      {
        id: 'slide_1',
        title: 'Simple Office Suite',
        subtitle: 'The Fast, Offline-First Productivity Suite for Enterprise Teams',
        layout: 'title',
        background: '#0f172a',
        textColor: '#ffffff',
        elements: []
      },
      {
        id: 'slide_2',
        title: 'The Problem',
        subtitle: 'Cloud bloat, subscription fatigue, and privacy vulnerabilities in modern tools',
        layout: 'content',
        background: '#ffffff',
        textColor: '#0f172a',
        elements: []
      },
      {
        id: 'slide_3',
        title: 'Our Solution',
        subtitle: 'Native desktop speed with complete offline privacy and 100% file format compatibility',
        layout: 'content',
        background: '#f8fafc',
        textColor: '#0f172a',
        elements: []
      },
      {
        id: 'slide_4',
        title: 'Business Model & Market',
        subtitle: '$45B Enterprise Office Market transitioning toward privacy and ownership',
        layout: 'content',
        background: '#ffffff',
        textColor: '#0f172a',
        elements: []
      }
    ]
  }
];

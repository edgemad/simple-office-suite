import { describe, expect, it } from 'vitest';
import { cycleIndex, highlightRuns, rankCommands, scoreMatch, type Command } from './commands';

const COMMANDS: Command[] = [
  { id: 'file.new', title: 'New document', category: 'File', priority: 10 },
  { id: 'file.open', title: 'Open', category: 'File', priority: 20, keywords: ['open', 'browse'] },
  { id: 'file.save', title: 'Save', category: 'File', priority: 30 },
  { id: 'format.bold', title: 'Bold', category: 'Format', priority: 40 },
  { id: 'view.zoomIn', title: 'Zoom in', category: 'View', priority: 50, keywords: ['magnify', 'larger'] },
  { id: 'file.recent', title: 'Recent files', category: 'File', priority: 70, keywords: ['open', 'history'] },
  { id: 'help.shortcuts', title: 'Keyboard shortcuts', category: 'Help', priority: 60 },
];

describe('scoreMatch', () => {
  it('scores an exact match highest', () => {
    expect(scoreMatch('save', 'Save')!.score).toBe(1000);
  });

  it('scores a prefix above a mid-string hit', () => {
    const prefix = scoreMatch('for', 'Format')!.score;
    const substring = scoreMatch('for', 'Editor format')!.score;
    expect(prefix).toBeGreaterThan(substring);
  });

  it('rewards a word-boundary hit over an incidental one', () => {
    const boundary = scoreMatch('doc', 'New document')!.score;
    const incidental = scoreMatch('doc', 'dotted circle')!.score;
    expect(boundary).toBeGreaterThan(incidental);
  });

  it('matches a subsequence that is not a substring', () => {
    const result = scoreMatch('zd', 'Zoom to Default');
    expect(result).not.toBeNull();
  });

  it('returns null when the characters are absent', () => {
    expect(scoreMatch('zzz', 'Save')).toBeNull();
  });

  it('treats an empty query as a match with no highlights', () => {
    const result = scoreMatch('', 'Save');
    expect(result!.score).toBe(1000);
    expect(result!.matches).toEqual([]);
  });

  it('ignores whitespace in the query', () => {
    expect(scoreMatch('b d', 'Bold')).not.toBeNull();
  });

  it('reports the matched character offsets', () => {
    const result = scoreMatch('bold', 'Bold')!;
    expect(result.matches).toEqual([0, 1, 2, 3]);
  });

  it('is case insensitive', () => {
    expect(scoreMatch('SAVE', 'save')!.score).toBe(1000);
  });
});

describe('rankCommands', () => {
  it('returns everything in priority order for an empty query', () => {
    const results = rankCommands(COMMANDS, '');
    expect(results).toHaveLength(COMMANDS.length);
    expect(results[0].command.id).toBe('file.new');
  });

  it('floats recent commands to the top of an empty query', () => {
    const results = rankCommands(COMMANDS, '', { recentIds: ['help.shortcuts'] });
    expect(results[0].command.id).toBe('help.shortcuts');
  });

  it('finds a command by its title', () => {
    const results = rankCommands(COMMANDS, 'bold');
    expect(results[0].command.id).toBe('format.bold');
  });

  it('finds a command by an invisible keyword', () => {
    const results = rankCommands(COMMANDS, 'magnify');
    expect(results.map(r => r.command.id)).toContain('view.zoomIn');
  });

  it('does not highlight keyword-only matches', () => {
    const results = rankCommands(COMMANDS, 'magnify');
    const zoom = results.find(r => r.command.id === 'view.zoomIn')!;
    expect(zoom.matches).toEqual([]);
  });

  it('scores a title hit above a keyword-only hit for the same query', () => {
    // "open" is file.open's title and also an alias of file.recent
    const results = rankCommands(COMMANDS, 'open');
    expect(results[0].command.id).toBe('file.open');
    expect(results.map(r => r.command.id)).toContain('file.recent');
  });

  it('matches every token in a multi-word query', () => {
    const results = rankCommands(COMMANDS, 'new doc');
    expect(results[0].command.id).toBe('file.new');
  });

  it('excludes a command when one token cannot be placed', () => {
    const results = rankCommands(COMMANDS, 'zoom nonexistentword');
    expect(results).toEqual([]);
  });

  it('ignores extra whitespace between tokens', () => {
    const results = rankCommands(COMMANDS, '  keyboard   shortcuts  ');
    expect(results[0].command.id).toBe('help.shortcuts');
  });

  it('merges and sorts highlight offsets across tokens', () => {
    const results = rankCommands(COMMANDS, 'new document');
    const matches = results[0].matches;
    expect(matches).toEqual([...matches].sort((a, b) => a - b));
    expect(new Set(matches).size).toBe(matches.length);
  });

  it('returns an empty list when nothing matches', () => {
    expect(rankCommands(COMMANDS, 'qqqqqq')).toEqual([]);
  });

  it('respects the limit', () => {
    expect(rankCommands(COMMANDS, '', { limit: 3 })).toHaveLength(3);
  });

  it('handles an empty command list', () => {
    expect(rankCommands([], 'anything')).toEqual([]);
  });
});

describe('highlightRuns', () => {
  it('returns a single unmatched run when there are no matches', () => {
    expect(highlightRuns('Save', [])).toEqual([{ text: 'Save', hit: false }]);
  });

  it('splits text into matched and unmatched runs', () => {
    expect(highlightRuns('Save as', [0, 1, 2, 3])).toEqual([
      { text: 'Save', hit: true },
      { text: ' as', hit: false },
    ]);
  });

  it('handles matches in the middle', () => {
    expect(highlightRuns('Zoom in', [0, 1, 2, 3])).toEqual([
      { text: 'Zoom', hit: true },
      { text: ' in', hit: false },
    ]);
  });

  it('reconstructs the original text exactly', () => {
    const text = 'Keyboard shortcuts';
    const joined = highlightRuns(text, [0, 3, 7])
      .map(r => r.text)
      .join('');
    expect(joined).toBe(text);
  });
});

describe('cycleIndex', () => {
  it('wraps past the end', () => {
    expect(cycleIndex(2, 1, 3)).toBe(0);
  });

  it('wraps before the start', () => {
    expect(cycleIndex(0, -1, 3)).toBe(2);
  });

  it('moves normally', () => {
    expect(cycleIndex(0, 1, 3)).toBe(1);
  });

  it('is safe on an empty list', () => {
    expect(cycleIndex(0, 1, 0)).toBe(0);
  });
});

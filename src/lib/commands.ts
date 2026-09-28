/**
 * Command palette matching.
 *
 * Deliberately a small subsequence matcher rather than a fuzzy-search library:
 * the palette has a few dozen commands, and a predictable ordering ("starts
 * with" beats "contains" beats "subsequence") is worth more here than the
 * tolerance of a fuzzy scorer. The scoring is pure so it can be tested without
 * a DOM.
 */

export interface Command {
  id: string;
  title: string;
  /** Grouping header in the results list. */
  category: string;
  /** Alternative words the user might type. */
  keywords?: string[];
  /** Lower runs first. */
  priority?: number;
}

export interface ScoredCommand {
  command: Command;
  score: number;
  /** Character indexes in `title` that matched, for highlighting. */
  matches: number[];
}

const EXACT = 1000;
const PREFIX = 500;
const WORD_BOUNDARY = 320;
const SUBSTRING = 200;
const SUBSEQUENCE = 100;

/**
 * Matches `query` against `text` as a subsequence of characters, scoring the
 * quality of the match. Returns null when the query is not a subsequence.
 *
 * Consecutive runs and word-boundary hits are rewarded so "fm" ranks
 * "File > New" above a scattered match in an unrelated label.
 */
export function scoreMatch(query: string, text: string): { score: number; matches: number[] } | null {
  if (!query) return { score: EXACT, matches: [] };

  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (t === q) return { score: EXACT, matches: [...text].map((_, i) => i) };

  const startsAt = t.indexOf(q);
  if (startsAt === 0) {
    return { score: PREFIX, matches: range(startsAt, startsAt + q.length) };
  }
  if (startsAt > 0) {
    // A hit right after a space is a word start, which reads as intentional.
    const bonus = text[startsAt - 1] === ' ' ? WORD_BOUNDARY : SUBSTRING;
    return { score: bonus, matches: range(startsAt, startsAt + q.length) };
  }

  // Fall back to a subsequence walk, rewarding consecutive characters.
  const matches: number[] = [];
  let score = 0;
  let ti = 0;
  let run = 0;

  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    if (ch === ' ') continue; // spaces in a query are just skipped
    let found = -1;
    while (ti < t.length) {
      if (t[ti] === ch) {
        found = ti;
        ti++;
        break;
      }
      ti++;
    }
    if (found === -1) return null;

    const isBoundary = found === 0 || text[found - 1] === ' ' || text[found - 1] === '>' || text[found - 1] === '-';
    score += isBoundary ? 14 : 6;
    run++;
    score += run;
    matches.push(found);
  }

  // Normalise by length: a short label matching a short query should win.
  return { score: score + SUBSEQUENCE - text.length * 0.5, matches };
}

function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i < end; i++) out.push(i);
  return out;
}

/** Splits `text` into matched / unmatched runs for rendering highlights. */
export function highlightRuns(
  text: string,
  matches: number[]
): { text: string; hit: boolean }[] {
  if (!matches.length) return [{ text, hit: false }];
  const set = new Set(matches);
  const out: { text: string; hit: boolean }[] = [];
  let current = '';
  let currentHit = set.has(0);

  for (let i = 0; i < text.length; i++) {
    const hit = set.has(i);
    if (hit !== currentHit && current) {
      out.push({ text: current, hit: currentHit });
      current = '';
    }
    currentHit = hit;
    current += text[i];
  }
  if (current) out.push({ text: current, hit: currentHit });
  return out;
}

export interface RankOptions {
  limit?: number;
  /** Commands whose id is in here are shown even with no query. */
  recentIds?: string[];
}

/**
 * Ranks `commands` against `query`. The query is split on whitespace and every
 * token must land somewhere (title, keyword, or category), so "new doc" finds
 * "New document" and "zoom in" finds "Zoom in". With an empty query it returns
 * the recent/default ordering so the palette is useful before typing.
 */
export function rankCommands(
  commands: Command[],
  query: string,
  options: RankOptions = {}
): ScoredCommand[] {
  const { limit = 40, recentIds = [] } = options;
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    const recent = new Set(recentIds);
    return [...commands]
      .sort((a, b) => {
        const aRecent = recent.has(a.id) ? 0 : 1;
        const bRecent = recent.has(b.id) ? 0 : 1;
        if (aRecent !== bRecent) return aRecent - bRecent;
        return (a.priority ?? 100) - (b.priority ?? 100);
      })
      .slice(0, limit)
      .map(command => ({ command, score: 0, matches: [] }));
  }

  const scored: ScoredCommand[] = [];

  for (const command of commands) {
    const haystack = [...(command.keywords ?? []), command.category];
    let total = 0;
    const matches = new Set<number>();
    let matchedAll = true;

    for (const token of tokens) {
      const titleHit = scoreMatch(token, command.title);
      if (titleHit) {
        total += titleHit.score;
        for (const index of titleHit.matches) matches.add(index);
        continue;
      }

      // A token can still land on an invisible alias, at a discount.
      let best: number | null = null;
      for (const candidate of haystack) {
        const result = scoreMatch(token, candidate);
        if (result && (best === null || result.score > best)) best = result.score;
      }
      if (best === null) {
        matchedAll = false;
        break;
      }
      total += best * 0.5;
    }

    if (matchedAll) {
      scored.push({
        command,
        score: total,
        matches: [...matches].sort((a, b) => a - b),
      });
    }
  }

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.command.priority ?? 100) - (b.command.priority ?? 100)
    )
    .slice(0, limit);
}

/** Wraps the active index around at both ends. */
export function cycleIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return ((current + delta) % length + length) % length;
}

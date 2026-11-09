import { requestType } from './template.js';

// Structured committee verdict, stored as a content property on the proposal so the byline badge
// and the committee panel can show it without re-reading the review. The agent sends plain
// strings; everything here is parsed defensively because it comes from the LLM.

export const VERDICT_PROPERTY = 'precedent-verdict';
// Confluence reads the byline title/tooltip straight from this property (contentPropertyKey).
export const BYLINE_PROPERTY = 'precedent-byline-7f3c2a';

const VERDICTS = ['GO', 'PIVOT', 'STOP'];
const RULINGS = ['upheld', 'partly upheld', 'rejected'];
const MAX_ITEMS = 12;
const MAX_TEXT = 300;

const clip = (text, max = MAX_TEXT) => String(text || '').trim().slice(0, max);

function lines(raw) {
  return String(raw || '')
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
}

export function parseVerdict(raw) {
  const word = String(raw || '').toUpperCase().match(/\b(GO|PIVOT|STOP)\b/);
  return word && VERDICTS.includes(word[1]) ? word[1] : null;
}

export function parseScore(raw, max = 100) {
  const n = Number(String(raw ?? '').match(/-?\d+(\.\d+)?/)?.[0]);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(max, Math.round(n)));
}

/** "Team & execution fit=15; Timing=12" or one per line, ":" or "=". */
export function parseAxes(raw) {
  return String(raw || '')
    .split(/[;\n]/)
    .map((part) => part.replace(/^\s*[-*•]\s*/, ''))
    .map((part) => part.match(/^\s*([^:=]+?)\s*[:=]\s*(\d+(?:\.\d+)?)/))
    .filter(Boolean)
    .map((m) => ({ name: clip(m[1], 60), score: parseScore(m[2], 25) }))
    .slice(0, 6);
}

/** "- upheld | Front desk workload" lines. Unknown rulings are kept as "noted". */
export function parseRulings(raw) {
  return lines(raw)
    .map((line) => {
      const [first, ...rest] = line.split('|');
      const ruling = first.trim().toLowerCase().replace(/\*/g, '');
      if (!rest.length) return { ruling: 'noted', summary: clip(line) };
      return { ruling: RULINGS.includes(ruling) ? ruling : 'noted', summary: clip(rest.join('|')) };
    })
    .filter((r) => r.summary)
    .slice(0, MAX_ITEMS);
}

/** "- 30 | Signed letter of intent from 3 clinics" lines. */
export function parseGates(raw) {
  return lines(raw)
    .map((line) => {
      const [first, ...rest] = line.split('|');
      const days = parseScore(first, 365);
      if (!rest.length || days === null) return null;
      return { days, criterion: clip(rest.join('|')) };
    })
    .filter((g) => g && g.criterion)
    .slice(0, 6);
}

/** Builds the stored record, or null when the payload carries no verdict (e.g. Market Research). */
export function buildVerdictRecord(payload, review, now = new Date()) {
  const verdict = parseVerdict(payload?.verdict);
  if (!verdict) return null;
  return {
    version: 1,
    verdict,
    score: parseScore(payload?.committeeScore),
    axes: parseAxes(payload?.axisScores),
    objections: parseRulings(payload?.objectionRulings),
    gates: parseGates(payload?.stageGates),
    type: requestType(String(payload?.requestType || '').trim().toLowerCase()),
    review: review ? { title: clip(review.title, 200), url: review.url } : null,
    reviewedAt: now.toISOString(),
    epic: null,
  };
}

export function bylineFor(record) {
  if (!record?.verdict) return { title: 'Precedent', tooltip: 'Not reviewed yet' };
  const score = record.score === null || record.score === undefined ? '' : ` · ${record.score}`;
  const upheld = (record.objections || []).filter((o) => o.ruling !== 'rejected').length;
  const fresh = record.newComments > 0 ? ` · ${record.newComments} new` : '';
  return {
    title: `Committee: ${record.verdict}${score}${fresh}`,
    tooltip: record.newComments > 0
      ? `${record.newComments} new comments since the review: consider re-running it.`
      : `${record.objections?.length || 0} objections answered, ${upheld} upheld. Click for details.`,
  };
}

/** Counts a new comment against the verdict, ignoring comments older than the review. */
export function withNewComment(record, commentCreated) {
  if (!record?.verdict) return null;
  const created = new Date(commentCreated || Date.now()).getTime();
  const reviewed = new Date(record.reviewedAt).getTime();
  if (Number.isFinite(reviewed) && created <= reviewed) return null;
  return { ...record, newComments: (record.newComments || 0) + 1 };
}

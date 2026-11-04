// Shapes Confluence comments into the "objections" the review agents must answer.
import { storageToText } from './format.js';

const MAX_COMMENT_CHARS = 600;
export const MAX_OBJECTIONS = 20;

// Titles of the pages our agents save, so a run started from a report finds its proposal.
const REPORT_TITLE = /^(market research|devil's advocate review|cfo review|sprintfounders report)\b/i;

export function isReportTitle(title) {
  return REPORT_TITLE.test(String(title || '').trim());
}

/** One footer or inline comment -> { page, quote, comment, createdAt }, or null if empty. */
export function toObjection(pageTitle, raw, kind) {
  const comment = storageToText(raw?.body?.storage?.value || '', MAX_COMMENT_CHARS).text;
  if (!comment) return null;
  if (kind === 'inline' && raw?.resolutionStatus === 'resolved') return null;
  const quote = kind === 'inline' ? raw?.properties?.inlineOriginalSelection || null : null;
  return { page: pageTitle, quote, comment, createdAt: raw?.version?.createdAt || null };
}

/** Oldest first, so the agent reads the discussion in order; capped to the token budget. */
export function collectObjections(groups) {
  const all = [];
  for (const { pageTitle, footer = [], inline = [] } of groups) {
    for (const c of inline) all.push(toObjection(pageTitle, c, 'inline'));
    for (const c of footer) all.push(toObjection(pageTitle, c, 'footer'));
  }
  return all
    .filter(Boolean)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .slice(0, MAX_OBJECTIONS);
}

// Builds CQL / JQL from agent-supplied keywords. Keywords come from the LLM, so they are
// sanitised to plain words before being embedded in a query string.

const MAX_KEYWORDS = 6;

export function sanitizeKeywords(raw) {
  const words = String(raw || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ''))
    .filter((w) => w.length >= 3);
  return [...new Set(words)].slice(0, MAX_KEYWORDS);
}

export function isValidId(id) {
  return /^\d+$/.test(String(id || ''));
}

/** Pages matching any keyword, excluding the proposal itself. */
export function buildCql(keywords, excludePageId) {
  if (!keywords.length) return null;
  const terms = keywords.map((k) => `text ~ "${k}"`).join(' OR ');
  const exclude = isValidId(excludePageId) ? ` AND id != ${excludePageId}` : '';
  // No ORDER BY: Confluence then ranks by relevance, so the closest precedent comes first.
  return `type = page AND (${terms})${exclude}`;
}

export function buildJql(keywords) {
  if (!keywords.length) return null;
  const terms = keywords.map((k) => `text ~ "${k}"`).join(' OR ');
  return `(${terms}) ORDER BY updated DESC`;
}

// Turns the agent's plan into Jira issues: story parsing, issue type selection and ADF bodies.

export const MAX_STORIES = 10;
const MAX_SUMMARY = 250;

export function isValidProjectKey(key) {
  return /^[A-Z][A-Z0-9_]{1,9}$/.test(String(key || ''));
}

/** "- Summary | details" lines (bullets or numbered) -> [{ summary, details }]. */
export function parseStories(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/))
    .filter(Boolean)
    .map((m) => {
      const [summary, ...rest] = m[1].split('|');
      return {
        summary: summary.replace(/\*\*/g, '').trim().slice(0, MAX_SUMMARY),
        details: rest.join('|').trim(),
      };
    })
    .filter((s) => s.summary)
    .slice(0, MAX_STORIES);
}

/** Epic = hierarchy level 1; story = level 0, non-subtask, preferring "Story" over "Task". */
export function pickIssueTypes(types) {
  const list = types || [];
  const epic = list.find((t) => t.hierarchyLevel === 1);
  const standard = list.filter((t) => t.hierarchyLevel === 0 && !t.subtask);
  const story = standard.find((t) => /story|historia/i.test(t.name)) || standard[0];
  return { epicTypeId: epic?.id || null, storyTypeId: story?.id || null };
}

// Inline Markdown -> ADF text nodes: **bold** and [text](https://url) only.
function inlineNodes(text) {
  const nodes = [];
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) nodes.push({ type: 'text', text: text.slice(last, m.index) });
    if (m[1]) nodes.push({ type: 'text', text: m[1], marks: [{ type: 'strong' }] });
    else nodes.push({ type: 'text', text: m[2], marks: [{ type: 'link', attrs: { href: m[3] } }] });
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push({ type: 'text', text: text.slice(last) });
  return nodes;
}

/** Plain text with paragraphs and "- " bullets -> Atlassian Document Format. */
export function textToAdf(text) {
  const content = [];
  let bullets = null;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!bullets) content.push((bullets = { type: 'bulletList', content: [] }));
      bullets.content.push({ type: 'listItem', content: [{ type: 'paragraph', content: inlineNodes(bullet[1]) }] });
    } else {
      bullets = null;
      if (line) content.push({ type: 'paragraph', content: inlineNodes(line) });
    }
  }
  return { type: 'doc', version: 1, content };
}

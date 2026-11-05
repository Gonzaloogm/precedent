// "Ask the people who were there": who wrote or worked on each precedent, and their teams,
// read from the Teamwork Graph. Pure helpers only; the API calls live in src/graph.js.

export const MAX_PRECEDENTS = 4;
export const MAX_PEOPLE = 5;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'our', 'your', 'this', 'that', 'new', 'proposal',
  'project', 'initiative', 'plan', 'pilot', 'build', 'using', 'about',
]);

export function pageAri(cloudId, pageId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(cloudId || '')) || !/^\d+$/.test(String(pageId || ''))) return null;
  return `ari:cloud:confluence:${cloudId}:page/${pageId}`;
}

/** Search words for a proposal title: "Proposal: AI scheduling assistant for clinics" -> scheduling assistant clinics. */
export function titleKeywords(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/^proposal:\s*/, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .slice(0, 6)
    .join(' ');
}

/** Users from a Teamwork Graph connection: { edges: [{ node: { __typename, id, name } }] }. */
export function usersFromConnection(connection) {
  return (connection?.edges || [])
    .map((e) => e?.node)
    .filter((n) => n && n.__typename === 'AtlassianUser' && n.id && n.name)
    .map((n) => ({ id: String(n.id), name: String(n.name).slice(0, 80) }));
}

export function teamsFromConnection(connection) {
  return (connection?.edges || [])
    .map((e) => e?.node)
    .filter((n) => n && (n.name || n.displayName))
    .map((n) => String(n.name || n.displayName).slice(0, 80))
    .slice(0, 3);
}

/** Author first, then other contributors, without repeating the author. */
export function pagePeople(creators, contributors) {
  const people = creators.map((u) => ({ ...u, role: 'author' }));
  for (const u of contributors) {
    if (!people.some((p) => p.id === u.id)) people.push({ ...u, role: 'contributor' });
  }
  return people;
}

/**
 * One entry per person across all precedents, ordered by the closest precedent they touched
 * (precedents arrive in relevance order) and authors before contributors.
 * precedents: [{ title, url, people: [{ id, name, role }] }]
 */
export function whoToAsk(precedents, teamsById = {}, viewerId = null) {
  const byId = new Map();
  precedents.forEach((precedent, rank) => {
    for (const person of precedent.people || []) {
      const entry = byId.get(person.id) || {
        id: person.id,
        name: person.name,
        teams: teamsById[person.id] || [],
        isViewer: Boolean(viewerId && person.id.endsWith(`/${viewerId}`)),
        rank: rank * 2 + (person.role === 'author' ? 0 : 1),
        pages: [],
      };
      entry.rank = Math.min(entry.rank, rank * 2 + (person.role === 'author' ? 0 : 1));
      if (!entry.pages.some((p) => p.url === precedent.url)) {
        entry.pages.push({ title: precedent.title, url: precedent.url, role: person.role });
      }
      byId.set(person.id, entry);
    }
  });
  return [...byId.values()]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_PEOPLE)
    .map(({ rank, ...rest }) => rest);
}

/** One line per person for the agents: "Marta Ruiz (Operations): author of 2025 Retro: ...". */
export function peopleSummary(people) {
  return people.map((p) => {
    const team = p.teams.length ? ` (${p.teams.join(', ')})` : '';
    const you = p.isViewer ? ' [the person asking]' : '';
    const work = p.pages.map((pg) => `${pg.role} of "${pg.title}"`).join('; ');
    return `${p.name}${team}${you}: ${work}`;
  });
}

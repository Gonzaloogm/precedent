// Teamwork Graph calls (Preview API), always as the user so it only returns what they can see.
// Every call is optional: if the graph is unavailable, callers get an empty list and carry on.
import api, { route } from '@forge/api';
import {
  MAX_PRECEDENTS,
  pageAri,
  usersFromConnection,
  teamsFromConnection,
  pagePeople,
  whoToAsk,
} from './lib/people.js';

async function graph(query, variables) {
  const response = await api.asUser().requestTeamworkGraph(query, variables);
  const body = await response.json();
  if (!response.ok || body?.errors?.length) {
    const err = new Error(`Teamwork Graph ${response.status}: ${JSON.stringify(body?.errors || body).slice(0, 300)}`);
    err.status = response.status;
    throw err;
  }
  return body.data || {};
}

/** Cloud id from the event context, or from the site itself when the context does not carry it. */
export async function resolveCloudId(fromContext) {
  if (/^[0-9a-f-]{36}$/i.test(String(fromContext || ''))) return fromContext;
  const response = await api.asUser().requestConfluence(route`/_edge/tenant_info`, { headers: { Accept: 'application/json' } });
  return response.ok ? (await response.json())?.cloudId : null;
}

const USER_FIELDS = '__typename ... on AtlassianUser { id name }';

async function peopleOnPages(cloudId, pages) {
  const targets = pages.map((p) => ({ ...p, ari: pageAri(cloudId, p.id) })).filter((p) => p.ari);
  if (!targets.length) return [];
  const params = targets.map((_, i) => `$p${i}: ID!`).join(', ');
  const fields = targets
    .map(
      (_, i) =>
        `a${i}: confluencePageCreator(id: $p${i}, first: 3) { edges { node { ${USER_FIELDS} } } }\n` +
        `c${i}: confluencePageContributors(id: $p${i}, first: 5) { edges { node { ${USER_FIELDS} } } }`
    )
    .join('\n');
  const variables = Object.fromEntries(targets.map((t, i) => [`p${i}`, t.ari]));
  const data = await graph(`query precedent_people(${params}) {\n${fields}\n}`, variables);
  return targets.map((t, i) => ({
    title: t.title,
    url: t.url,
    people: pagePeople(usersFromConnection(data[`a${i}`]), usersFromConnection(data[`c${i}`])),
  }));
}

async function teamsOf(userIds) {
  if (!userIds.length) return {};
  const params = userIds.map((_, i) => `$u${i}: ID!`).join(', ');
  const variables = Object.fromEntries(userIds.map((id, i) => [`u${i}`, id]));
  // The team's name field has changed between Preview releases: try both before giving up.
  for (const nameField of ['name', 'displayName']) {
    const fields = userIds
      .map((_, i) => `t${i}: atlassianUserInTeams(userId: $u${i}, first: 3) { edges { node { ... on AtlassianTeam { id ${nameField} } } } }`)
      .join('\n');
    try {
      const data = await graph(`query precedent_teams(${params}) {\n${fields}\n}`, variables);
      return Object.fromEntries(userIds.map((id, i) => [id, teamsFromConnection(data[`t${i}`])]));
    } catch (err) {
      console.warn('Teamwork Graph teams query failed', nameField, err.message);
    }
  }
  return {};
}

/**
 * pages: precedent pages in relevance order, [{ id, title, url }].
 * Returns the people to ask, or [] when the graph cannot be reached.
 */
export async function peopleWhoWereThere({ cloudId, pages, viewerAccountId }) {
  try {
    const id = await resolveCloudId(cloudId);
    if (!id) return [];
    const precedents = await peopleOnPages(id, pages.slice(0, MAX_PRECEDENTS));
    const people = whoToAsk(precedents, {}, viewerAccountId);
    const teams = await teamsOf(people.map((p) => p.id));
    return people.map((p) => ({ ...p, teams: teams[p.id] || [] }));
  } catch (err) {
    console.warn('Teamwork Graph unavailable', err.message);
    return [];
  }
}

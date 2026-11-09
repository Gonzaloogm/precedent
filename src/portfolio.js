// Resolver for the portfolio page: every proposal with a saved committee verdict, with live gate
// state from Jira. Everything runs as the user, so people only see proposals they can open.
import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import { readVerdict } from './index.js';
import { gateStatuses } from './gateStatus.js';
import { isValidId } from './lib/search.js';
import { MAX_PROPOSALS, REVIEW_TITLE_CQL, portfolioRow, sortPortfolio, portfolioTotals } from './lib/portfolio.js';

// Proposals are found through their Devil's Advocate review pages, which are always children of
// the proposal. This needs no extra label or scope.
async function reviewedProposals() {
  const response = await api
    .asUser()
    .requestConfluence(route`/wiki/rest/api/content/search?cql=${REVIEW_TITLE_CQL}&limit=50&expand=ancestors`, {
      headers: { Accept: 'application/json' },
    });
  if (!response.ok) throw new Error(`Confluence search ${response.status}`);
  const data = await response.json();
  const base = data._links?.base || '';
  const byId = new Map();
  for (const review of data.results || []) {
    const parent = (review.ancestors || []).at(-1);
    if (parent && isValidId(parent.id) && !byId.has(parent.id)) {
      byId.set(parent.id, { id: String(parent.id), title: parent.title, url: base + (parent._links?.webui || '') });
    }
  }
  return { base: base.replace(/\/wiki$/, ''), proposals: [...byId.values()].slice(0, MAX_PROPOSALS) };
}

/** Every reviewed proposal with live gate state, worst first. Shared by the page and the MCP tool. */
export async function loadPortfolio() {
  const { base, proposals } = await reviewedProposals();
  const withRecords = (
    await Promise.all(proposals.map(async (p) => ({ ...p, record: await readVerdict(p.id).catch(() => null) })))
  ).filter((p) => p.record?.verdict);
  // One Jira query for every gate in the portfolio.
  const statuses = await gateStatuses(withRecords.flatMap((p) => p.record.gates || [])).catch(() => ({}));
  const rows = withRecords.map((p) => {
    const gates = (p.record.gates || []).map((g) => ({ ...g, ...(g.key ? statuses[g.key] : {}) }));
    return portfolioRow(p, p.record, gates);
  });
  const sorted = sortPortfolio(rows);
  return { siteUrl: base, rows: sorted, totals: portfolioTotals(sorted) };
}

const resolver = new Resolver();

resolver.define('getPortfolio', async () => {
  try {
    return await loadPortfolio();
  } catch (err) {
    console.error('getPortfolio failed', err.message);
    return { rows: [], error: 'The portfolio could not be loaded. Reload the page to try again.' };
  }
});

export const handler = resolver.getDefinitions();

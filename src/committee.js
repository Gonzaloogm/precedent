// Resolver for the committee panel (byline item on every Confluence page).
import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import { readVerdict, createGatesForPage, precedentPages } from './index.js';
import { peopleWhoWereThere } from './graph.js';
import { isReportTitle } from './lib/review.js';
import { isValidId } from './lib/search.js';
import { gateState } from './lib/gates.js';
import { checkMissedGates } from './gateCheck.js';

// Live status of the gate work items, so closing a gate in Jira shows up here immediately.
async function gateStatuses(gates) {
  const keys = (gates || []).map((g) => g.key).filter((k) => /^[A-Z][A-Z0-9_]+-\d+$/.test(k || ''));
  if (!keys.length) return {};
  const response = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ jql: `key in (${keys.join(',')})`, maxResults: keys.length, fields: ['status', 'duedate'] }),
  });
  if (!response.ok) return {};
  const data = await response.json();
  return Object.fromEntries(
    (data.issues || []).map((i) => [i.key, { state: gateState(i.fields), status: i.fields?.status?.name, ...(i.fields?.duedate ? { due: i.fields.duedate } : {}) }])
  );
}

async function page(pageId) {
  const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}`, {
    headers: { Accept: 'application/json' },
  });
  return response.ok ? response.json() : null;
}

const resolver = new Resolver();

resolver.define('getVerdict', async ({ context }) => {
  const contentId = context?.extension?.content?.id;
  if (!isValidId(contentId)) return { record: null };
  try {
    let record = await readVerdict(contentId);
    let proposal = await page(contentId);
    // On a report page, show the verdict of the proposal it belongs to.
    if (!record && proposal && isReportTitle(proposal.title) && isValidId(proposal.parentId)) {
      record = await readVerdict(proposal.parentId);
      proposal = await page(proposal.parentId);
    }
    const statuses = record ? await gateStatuses(record.gates).catch(() => ({})) : {};
    const gates = (record?.gates || []).map((g) => ({ ...g, ...(g.key ? statuses[g.key] : {}) }));
    return { record: record ? { ...record, gates } : null, proposalTitle: proposal?.title || null };
  } catch (err) {
    console.error('getVerdict failed', err.message);
    return { record: null, error: 'The committee verdict could not be loaded.' };
  }
});

resolver.define('createGates', async ({ context }) => {
  const contentId = context?.extension?.content?.id;
  if (!isValidId(contentId)) return { error: 'Open the proposal page.' };
  try {
    // From a report page, act on the proposal it belongs to (same rule as getVerdict).
    let pageId = contentId;
    if (!(await readVerdict(contentId))) {
      const current = await page(contentId);
      if (current && isReportTitle(current.title) && isValidId(current.parentId)) pageId = current.parentId;
    }
    return await createGatesForPage(pageId);
  } catch (err) {
    console.error('createGates failed', err.message);
    return { error: 'The stage gates could not be created in Jira.' };
  }
});

// Teamwork Graph: who wrote or worked on the closest precedents, loaded after the verdict.
resolver.define('getPeople', async ({ context }) => {
  const contentId = context?.extension?.content?.id;
  if (!isValidId(contentId)) return { people: [] };
  try {
    let proposal = await page(contentId);
    if (proposal && isReportTitle(proposal.title) && isValidId(proposal.parentId)) proposal = await page(proposal.parentId);
    if (!proposal) return { people: [] };
    const pages = await precedentPages(proposal.title, proposal.id);
    const people = await peopleWhoWereThere({ cloudId: context?.cloudId, pages, viewerAccountId: context?.accountId });
    return { people };
  } catch (err) {
    console.error('getPeople failed', err.message);
    return { people: [] };
  }
});

// Same as the daily check, on demand (useful right after moving a due date).
resolver.define('checkGatesNow', async () => {
  try {
    return { flagged: await checkMissedGates() };
  } catch (err) {
    console.error('checkGatesNow failed', err.message);
    return { flagged: [], error: 'The stage gates could not be checked.' };
  }
});

export const handler = resolver.getDefinitions();

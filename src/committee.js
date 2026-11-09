// Resolver for the committee panel: the byline item on Confluence pages and the issue context
// panel in Jira. Both resolve to the proposal page that holds the verdict.
import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import { readVerdict, createGatesForPage, precedentPages } from './index.js';
import { peopleWhoWereThere } from './graph.js';
import { isReportTitle } from './lib/review.js';
import { isValidId } from './lib/search.js';
import { pageIdFromLabels, GATE_LABEL } from './lib/gates.js';
import { liveGates } from './gateStatus.js';
import { assumptionStates } from './lib/assumptions.js';
import { checkMissedGates } from './gateCheck.js';

async function page(pageId) {
  const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}`, {
    headers: { Accept: 'application/json' },
  });
  return response.ok ? response.json() : null;
}

async function issue(key) {
  const response = await api.asUser().requestJira(route`/rest/api/3/issue/${key}?fields=labels,parent`, {
    headers: { Accept: 'application/json' },
  });
  return response.ok ? response.json() : null;
}

// Gates carry the proposal page in a label; epics created before the epic label existed are
// found through their gate children.
async function pageIdFromGateChildren(key) {
  const response = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ jql: `parent = ${key} AND labels = "${GATE_LABEL}"`, maxResults: 1, fields: ['labels'] }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return pageIdFromLabels(data.issues?.[0]?.fields?.labels);
}

async function pageIdForIssue(key) {
  if (!/^[A-Z][A-Z0-9_]+-\d+$/.test(String(key || ''))) return null;
  const current = await issue(key);
  if (!current) return null;
  const parentKey = current.fields?.parent?.key;
  const parent = parentKey ? await issue(parentKey) : null;
  return (
    pageIdFromLabels(current.fields?.labels) ||
    pageIdFromLabels(parent?.fields?.labels) ||
    (await pageIdFromGateChildren(key)) ||
    (parentKey ? await pageIdFromGateChildren(parentKey) : null)
  );
}

/** The proposal page behind this panel: the page itself, its parent for a report, or the Jira link. */
async function proposalFor(context) {
  const issueKey = context?.extension?.issue?.key;
  if (issueKey) {
    const pageId = await pageIdForIssue(issueKey);
    return { inJira: true, proposal: pageId ? await page(pageId) : null };
  }
  const contentId = context?.extension?.content?.id;
  if (!isValidId(contentId)) return { inJira: false, proposal: null };
  let proposal = await page(contentId);
  // On a report page, act on the proposal it belongs to.
  if (proposal && !(await readVerdict(contentId)) && isReportTitle(proposal.title) && isValidId(proposal.parentId)) {
    proposal = await page(proposal.parentId);
  }
  return { inJira: false, proposal };
}

const pageUrl = (p) => (p?._links?.base && p?._links?.webui ? p._links.base + p._links.webui : null);

const resolver = new Resolver();

resolver.define('getVerdict', async ({ context }) => {
  try {
    const { inJira, proposal } = await proposalFor(context);
    if (!proposal) return { record: null, inJira };
    const record = await readVerdict(proposal.id);
    const gates = record ? await liveGates(record) : [];
    return {
      record: record
        ? { ...record, gates, assumptions: assumptionStates(record.assumptions, gates), history: record.history || [] }
        : null,
      proposalTitle: proposal.title || null,
      proposalUrl: pageUrl(proposal),
      inJira,
    };
  } catch (err) {
    console.error('getVerdict failed', err.message);
    return { record: null, error: 'The committee verdict could not be loaded.' };
  }
});

resolver.define('createGates', async ({ context }) => {
  try {
    const { proposal } = await proposalFor(context);
    if (!proposal) return { error: 'Open the proposal page.' };
    return await createGatesForPage(proposal.id);
  } catch (err) {
    console.error('createGates failed', err.message);
    return { error: 'The stage gates could not be created in Jira.' };
  }
});

// Teamwork Graph: who wrote or worked on the closest precedents, loaded after the verdict.
resolver.define('getPeople', async ({ context }) => {
  try {
    const { proposal } = await proposalFor(context);
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

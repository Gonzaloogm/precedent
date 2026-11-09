// Read-only actions that other agents can call: from Rovo through the precedent-check skill, and
// from external AI clients through the rovo:mcp module. Both run as the user who calls them.
import api, { route } from '@forge/api';
import { readVerdict } from './index.js';
import { liveGates } from './gateStatus.js';
import { loadPortfolio } from './portfolio.js';
import { assumptionStates, ledgerLines } from './lib/assumptions.js';
import { isReportTitle } from './lib/review.js';
import { isValidId } from './lib/search.js';
import { friendlyError } from './lib/errors.js';

const LIGHTS = {
  red: 'red',
  'at risk': 'red',
  amber: 'amber',
  'needs attention': 'amber',
  green: 'green',
  'on track': 'green',
};

async function page(pageId) {
  const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}`, {
    headers: { Accept: 'application/json' },
  });
  return response.ok ? response.json() : null;
}

// Outside Confluence (an external MCP client) there is no current page: find the proposal by title.
async function findProposalByTitle(title) {
  const words = String(title || '')
    .replace(/["\\]/g, ' ')
    .trim()
    .slice(0, 120);
  if (!words) return null;
  const cql = `type = page AND title ~ "${words}"`;
  const response = await api.asUser().requestConfluence(route`/wiki/rest/api/content/search?cql=${cql}&limit=${10}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const match = (data.results || []).find((r) => !isReportTitle(r.title));
  return match ? String(match.id) : null;
}

const pageUrl = (p) => (p?._links?.base && p?._links?.webui ? p._links.base + p._links.webui : null);

export async function getCommitteeVerdict(payload) {
  try {
    const fromContext = payload?.context?.confluence?.contentId;
    let pageId = isValidId(fromContext)
      ? String(fromContext)
      : isValidId(payload?.pageId)
        ? String(payload.pageId)
        : null;
    if (!pageId && payload?.title) pageId = await findProposalByTitle(payload.title);
    if (!pageId) return { error: 'Give the proposal page ID or its title.' };

    let proposal = await page(pageId);
    if (!proposal) return { error: 'That page does not exist or you cannot open it.' };
    let record = await readVerdict(proposal.id);
    if (!record && isReportTitle(proposal.title) && isValidId(proposal.parentId)) {
      proposal = await page(proposal.parentId);
      record = proposal ? await readVerdict(proposal.id) : null;
    }
    if (!record)
      return {
        proposal: { title: proposal?.title, url: pageUrl(proposal) },
        verdict: null,
        note: 'Not reviewed by the committee yet.',
      };

    const gates = await liveGates(record);
    return {
      proposal: { title: proposal.title, url: pageUrl(proposal) },
      requestType: record.type || 'initiative',
      verdict: record.verdict,
      score: record.score,
      reviewedAt: record.reviewedAt,
      review: record.review?.url || null,
      objections: record.objections,
      stageGates: gates.map((g) => ({
        day: g.days,
        criterion: g.criterion,
        key: g.key || null,
        due: g.due || null,
        state: g.state || 'not tracked',
      })),
      assumptionLedger: ledgerLines(assumptionStates(record.assumptions, gates), record.history),
      newCommentsSinceReview: record.newComments || 0,
      jiraEpic: record.epic?.key || null,
    };
  } catch (err) {
    console.error('getCommitteeVerdict failed', err.message);
    return { error: friendlyError(err, 'read the committee verdict') };
  }
}

export async function getPortfolio(payload) {
  try {
    const { rows, totals } = await loadPortfolio();
    const light =
      LIGHTS[
        String(payload?.status || '')
          .trim()
          .toLowerCase()
      ];
    const selected = light ? rows.filter((r) => r.light === light) : rows;
    return {
      totals: { atRisk: totals.red, needsAttention: totals.amber, onTrack: totals.green },
      proposals: selected.map((r) => ({
        title: r.title,
        url: r.url,
        requestType: r.type,
        status: { red: 'at risk', amber: 'needs attention', green: 'on track' }[r.light],
        reason: r.reason,
        verdict: r.verdict,
        score: r.score,
        reviewedAt: r.reviewedAt,
        gates: r.gates,
        nextGate: r.next ? { due: r.next.due, criterion: r.next.criterion } : null,
        jiraEpic: r.epic?.key || null,
      })),
    };
  } catch (err) {
    console.error('getPortfolio tool failed', err.message);
    return { error: friendlyError(err, 'read the portfolio') };
  }
}

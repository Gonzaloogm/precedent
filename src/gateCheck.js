// Daily stage gate check (scheduled trigger, runs as the app). Finds gates past their due date
// that are not done, comments on the gate and on the proposal, and labels the gate so it is only
// flagged once. Uses no LLM: it costs no Rovo credits.
import api, { route } from '@forge/api';
import { overdueGatesJql, pageIdFromLabels, missedGateMessage, OVERDUE_LABEL } from './lib/gates.js';
import { textToAdf } from './lib/jira.js';
import { markdownToStorage } from './lib/format.js';

const MAX_PER_RUN = 20;

async function jira(path, options = {}) {
  const response = await api.asApp().requestJira(path, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`Jira ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

async function proposalFor(pageId) {
  if (!pageId) return null;
  const response = await api.asApp().requestConfluence(route`/wiki/api/v2/pages/${pageId}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return { id: pageId };
  const page = await response.json();
  return { id: pageId, title: page.title, url: (page._links?.base || '') + (page._links?.webui || '') };
}

async function commentOnProposal(pageId, text) {
  const response = await api.asApp().requestConfluence(route`/wiki/api/v2/footer-comments`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageId, body: { representation: 'storage', value: markdownToStorage(text) } }),
  });
  if (!response.ok) console.error('proposal comment failed', response.status);
  return response.ok;
}

export async function checkMissedGates() {
  const data = await jira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    body: JSON.stringify({ jql: overdueGatesJql(), maxResults: MAX_PER_RUN, fields: ['summary', 'duedate', 'labels'] }),
  });
  const flagged = [];
  for (const issue of data?.issues || []) {
    try {
      const gate = { key: issue.key, summary: issue.fields?.summary, duedate: issue.fields?.duedate };
      const pageId = pageIdFromLabels(issue.fields?.labels);
      const proposal = await proposalFor(pageId);
      const message = missedGateMessage(gate, proposal?.url ? proposal : null);

      await jira(route`/rest/api/3/issue/${issue.key}/comment`, {
        method: 'POST',
        body: JSON.stringify({ body: textToAdf(message) }),
      });
      if (pageId) await commentOnProposal(pageId, `**${issue.key}**: ${message}`);
      await jira(route`/rest/api/3/issue/${issue.key}`, {
        method: 'PUT',
        body: JSON.stringify({ update: { labels: [{ add: OVERDUE_LABEL }] } }),
      });
      flagged.push(issue.key);
    } catch (err) {
      console.error('gate check failed for', issue.key, err.message);
    }
  }
  if (flagged.length) console.log('missed stage gates flagged', flagged.join(', '));
  return flagged;
}

// Scheduled trigger entry point.
export async function run() {
  await checkMissedGates();
  return { statusCode: 200 };
}

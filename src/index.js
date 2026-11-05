import api, { route } from '@forge/api';
import { storageToText, markdownToStorage, aiNoticePanel, stripLeadingTitle } from './lib/format.js';
import { sanitizeKeywords, isValidId, buildCql, buildJql } from './lib/search.js';
import { collectObjections, isReportTitle } from './lib/review.js';
import { parseStories, pickIssueTypes, textToAdf, isValidProjectKey, adfToText } from './lib/jira.js';
import { buildVerdictRecord, bylineFor, VERDICT_PROPERTY, BYLINE_PROPERTY } from './lib/verdict.js';
import { friendlyError } from './lib/errors.js';
import { GATE_LABEL, gateSummary, pageLabel, dueDateFor } from './lib/gates.js';

const MAX_RESULTS = 8;
const MAX_REPORTS = 4;
const MAX_REPORT_CHARS = 8000;

// Agent inputs can be hallucinated: prefer the page the user is actually on, and only accept
// numeric IDs. Permissions are enforced by calling the APIs asUser().
function resolvePageId(payload) {
  const fromContext = payload?.context?.confluence?.contentId;
  if (isValidId(fromContext)) return String(fromContext);
  if (isValidId(payload?.pageId)) return String(payload.pageId);
  return null;
}

async function readJson(response) {
  if (response.ok) return response.json();
  const detail = await response.text();
  const err = new Error(`Atlassian API ${response.status}: ${detail.slice(0, 300)}`);
  err.status = response.status;
  throw err;
}

async function fetchPage(pageId) {
  const response = await api
    .asUser()
    .requestConfluence(route`/wiki/api/v2/pages/${pageId}?body-format=storage`, {
      headers: { Accept: 'application/json' },
    });
  return readJson(response);
}

export async function getProposal(payload) {
  const pageId = resolvePageId(payload);
  if (!pageId) return { error: 'Open the proposal page in Confluence, or provide its page ID.' };

  try {
    const page = await fetchPage(pageId);
    const { text, truncated } = storageToText(page.body?.storage?.value);
    return { pageId, title: page.title, body: text, truncated };
  } catch (err) {
    console.error('getProposal failed', err.message);
    return { error: friendlyError(err, 'read the page') };
  }
}

async function confluenceGet(path) {
  const response = await api.asUser().requestConfluence(path, { headers: { Accept: 'application/json' } });
  return readJson(response);
}

async function fetchComments(pageId) {
  const [footer, inline] = await Promise.all([
    confluenceGet(route`/wiki/api/v2/pages/${pageId}/footer-comments?body-format=storage&limit=${25}`),
    confluenceGet(route`/wiki/api/v2/pages/${pageId}/inline-comments?body-format=storage&limit=${25}`),
  ]);
  return { footer: footer.results || [], inline: inline.results || [] };
}

export async function getReviewContext(payload) {
  const startId = resolvePageId(payload);
  if (!startId) return { error: 'Open the proposal (or one of its reports) in Confluence.' };

  try {
    // Started from a saved report: review its parent proposal instead.
    let proposal = await fetchPage(startId);
    if (isReportTitle(proposal.title) && isValidId(proposal.parentId)) {
      proposal = await fetchPage(proposal.parentId);
    }

    const children = await confluenceGet(route`/wiki/api/v2/pages/${proposal.id}/children?limit=${25}`);
    const reportRefs = (children.results || [])
      .filter((c) => c.status === 'current' && isReportTitle(c.title))
      .slice(0, MAX_REPORTS);
    const reportPages = await Promise.all(reportRefs.map((r) => fetchPage(r.id)));

    // Comments are the team's objections: reading them is optional, so failures only warn.
    const warnings = [];
    const groups = [];
    for (const page of [proposal, ...reportPages]) {
      try {
        groups.push({ pageTitle: page.title, ...(await fetchComments(page.id)) });
      } catch (err) {
        console.error('fetchComments failed', err.message);
        warnings.push(`Could not read comments on "${page.title}".`);
      }
    }

    return {
      proposal: { pageId: proposal.id, title: proposal.title, ...storageToText(proposal.body?.storage?.value) },
      reports: reportPages.map((p) => ({
        pageId: p.id,
        title: p.title,
        ...storageToText(p.body?.storage?.value, MAX_REPORT_CHARS),
      })),
      objections: collectObjections(groups),
      warnings,
    };
  } catch (err) {
    console.error('getReviewContext failed', err.message);
    return { error: friendlyError(err, 'read the proposal') };
  }
}

async function searchConfluence(keywords, excludePageId) {
  const cql = buildCql(keywords, excludePageId);
  const response = await api
    .asUser()
    .requestConfluence(
      route`/wiki/rest/api/search?cql=${cql}&limit=${MAX_RESULTS}&expand=content.history`,
      { headers: { Accept: 'application/json' } }
    );
  const data = await readJson(response);
  const base = data._links?.base || '';
  return {
    siteUrl: base.replace(/\/wiki$/, ''),
    pages: (data.results || []).map((r) => ({
      title: r.content?.title || r.title,
      url: base + (r.url || r.content?._links?.webui || ''),
      lastModified: r.lastModified || r.friendlyLastModified,
      excerpt: storageToText(r.excerpt || '', 300).text,
    })),
  };
}

async function searchJira(keywords, siteUrl) {
  const response = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jql: buildJql(keywords),
      maxResults: MAX_RESULTS,
      fields: ['summary', 'status', 'resolution', 'issuetype', 'updated', 'parent', 'description'],
    }),
  });
  const data = await readJson(response);
  // Parent and description matter: a "done" story under a cancelled epic is evidence of a past
  // failure, not reusable work, and the outcome is usually written in the epic description.
  return (data.issues || []).map((issue) => ({
    key: issue.key,
    summary: issue.fields?.summary,
    type: issue.fields?.issuetype?.name,
    status: issue.fields?.status?.name,
    resolution: issue.fields?.resolution?.name || null,
    updated: issue.fields?.updated,
    description: adfToText(issue.fields?.description, 400) || null,
    parent: issue.fields?.parent
      ? { key: issue.fields.parent.key, summary: issue.fields.parent.fields?.summary }
      : null,
    url: siteUrl ? `${siteUrl}/browse/${issue.key}` : null,
  }));
}

export async function findRelatedInitiatives(payload) {
  const keywords = sanitizeKeywords(payload?.keywords);
  if (!keywords.length) return { error: 'Provide 3 to 6 keywords describing the proposal.' };
  const pageId = resolvePageId(payload);

  // Each source fails independently: a site without Jira still gets Confluence results.
  const result = { keywords, confluencePages: [], jiraIssues: [], warnings: [] };
  let siteUrl = '';
  try {
    const confluence = await searchConfluence(keywords, pageId);
    siteUrl = confluence.siteUrl;
    result.confluencePages = confluence.pages;
  } catch (err) {
    console.error('Confluence search failed', err.message);
    result.warnings.push('Confluence search failed.');
  }
  try {
    result.jiraIssues = await searchJira(keywords, siteUrl);
  } catch (err) {
    console.error('Jira search failed', err.message);
    result.warnings.push('Jira search unavailable on this site.');
  }
  return result;
}

async function createChildPage(spaceId, parentId, title, storage) {
  return api.asUser().requestConfluence(route`/wiki/api/v2/pages`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceId,
      parentId,
      status: 'current',
      title,
      body: { representation: 'storage', value: storage },
    }),
  });
}

// ---------- Content properties (structured verdict on the proposal) ----------

// actor: 'user' from agent actions and the panel, 'app' from event triggers (no user present).
const confluenceAs = (actor) => (actor === 'app' ? api.asApp() : api.asUser());

async function getProperty(pageId, key, actor = 'user') {
  const response = await confluenceAs(actor).requestConfluence(
    route`/wiki/api/v2/pages/${pageId}/properties?key=${key}`,
    { headers: { Accept: 'application/json' } }
  );
  const data = await readJson(response);
  return data?.results?.[0] || null;
}

async function setProperty(pageId, key, value, actor = 'user') {
  const existing = await getProperty(pageId, key, actor);
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  const response = existing
    ? await confluenceAs(actor).requestConfluence(route`/wiki/api/v2/pages/${pageId}/properties/${existing.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ key, value, version: { number: (existing.version?.number || 1) + 1 } }),
      })
    : await confluenceAs(actor).requestConfluence(route`/wiki/api/v2/pages/${pageId}/properties`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key, value }),
      });
  return readJson(response);
}

export async function readVerdict(pageId, actor = 'user') {
  return (await getProperty(pageId, VERDICT_PROPERTY, actor))?.value || null;
}

export async function writeVerdict(pageId, record, actor = 'user') {
  await setProperty(pageId, VERDICT_PROPERTY, record, actor);
  await setProperty(pageId, BYLINE_PROPERTY, bylineFor(record), actor);
}

export async function saveReport(payload) {
  const pageId = resolvePageId(payload);
  if (!pageId) return { error: 'Open the proposal page in Confluence, or provide its page ID.' };
  if (!payload?.reportMarkdown?.trim()) return { error: 'The report is empty.' };

  try {
    // Reports always hang off the proposal, even when the run started from another report.
    let parent = await fetchPage(pageId);
    if (isReportTitle(parent.title) && isValidId(parent.parentId)) parent = await fetchPage(parent.parentId);
    const baseTitle = (payload.reportTitle || `Precedent report - ${parent.title}`).slice(0, 200);
    const storage = aiNoticePanel() + markdownToStorage(stripLeadingTitle(payload.reportMarkdown));

    let response = await createChildPage(parent.spaceId, parent.id, baseTitle, storage);
    if (response.status === 400 || response.status === 409) {
      // Titles are unique per space: retry once with a timestamp.
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      response = await createChildPage(parent.spaceId, parent.id, `${baseTitle} (${stamp})`, storage);
    }
    const page = await readJson(response);
    const url = (page._links?.base || '') + (page._links?.webui || '');

    // The Devil's Advocate also sends a structured verdict: keep it on the proposal for the panel.
    const record = buildVerdictRecord(payload, { title: page.title, url });
    let warning;
    if (record) {
      try {
        const previous = await readVerdict(parent.id);
        await writeVerdict(parent.id, { ...record, epic: previous?.epic || null });
      } catch (err) {
        console.error('saving verdict failed', err.message);
        warning = 'The review was saved, but the committee panel could not be updated.';
      }
    }
    return { saved: true, title: page.title, url, ...(record ? { verdict: record.verdict } : {}), ...(warning ? { warning } : {}) };
  } catch (err) {
    console.error('saveReport failed', err.message);
    return { error: friendlyError(err, 'save the report') };
  }
}

async function jiraRequest(path, options = {}) {
  const response = await api.asUser().requestJira(path, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
  });
  return readJson(response);
}

export async function listJiraProjects() {
  try {
    const data = await jiraRequest(route`/rest/api/3/project/search?maxResults=${30}&orderBy=${'name'}`);
    return {
      projects: (data.values || []).map((p) => ({ key: p.key, name: p.name, type: p.projectTypeKey })),
    };
  } catch (err) {
    console.error('listJiraProjects failed', err.message);
    return { error: 'Jira is not available on this site, or you cannot browse its projects.' };
  }
}

// The proposal page, so the epic links back to where the decision was made.
async function proposalLink(payload) {
  const pageId = resolvePageId(payload);
  if (!pageId) return null;
  try {
    let page = await fetchPage(pageId);
    if (isReportTitle(page.title) && isValidId(page.parentId)) page = await fetchPage(page.parentId);
    const base = page._links?.base || '';
    return { title: page.title, url: base + (page._links?.webui || ''), siteUrl: base.replace(/\/wiki$/, '') };
  } catch (err) {
    console.error('proposalLink failed', err.message);
    return null;
  }
}

// Turns the verdict's stage gates into work items under the epic (due dates included) and records
// the epic and gate keys on the proposal's verdict, so the panel and the daily check can use them.
async function attachEpicAndGates(payload, projectKey, epic, gateTypeId) {
  try {
    const pageId = resolvePageId(payload);
    if (!pageId) return [];
    let page = await fetchPage(pageId);
    if (isReportTitle(page.title) && isValidId(page.parentId)) page = await fetchPage(page.parentId);
    const record = await readVerdict(page.id);
    if (!record) return [];

    let gates = record.gates || [];
    if (gateTypeId && gates.length && !gates.some((g) => g.key)) {
      const issueUpdates = (withDueDate) =>
        gates.map((g) => ({
          fields: {
            project: { key: projectKey },
            issuetype: { id: gateTypeId },
            parent: { key: epic.key },
            summary: gateSummary(g),
            labels: [GATE_LABEL, pageLabel(page.id)],
            description: textToAdf(
              `Stop criterion from the committee review. If this is not done by the due date, the committee recommends re-running the review before more budget is spent.\n\nDecision record: [${page.title}](${(page._links?.base || '') + (page._links?.webui || '')})`
            ),
            ...(withDueDate ? { duedate: dueDateFor(record.reviewedAt, g.days) } : {}),
          },
        }));
      let bulk = await jiraRequest(route`/rest/api/3/issue/bulk`, {
        method: 'POST',
        body: JSON.stringify({ issueUpdates: issueUpdates(true) }),
      }).catch(() => null);
      if (!bulk?.issues?.length) {
        // Some projects do not show the due date field on their create screen.
        bulk = await jiraRequest(route`/rest/api/3/issue/bulk`, {
          method: 'POST',
          body: JSON.stringify({ issueUpdates: issueUpdates(false) }),
        });
      }
      const keys = (bulk?.issues || []).map((i) => i.key);
      gates = gates.map((g, i) => ({ ...g, key: keys[i] || null, due: dueDateFor(record.reviewedAt, g.days) }));
    }
    await writeVerdict(page.id, { ...record, epic, gates });
    return gates.filter((g) => g.key);
  } catch (err) {
    console.error('attachEpicAndGates failed', err.message);
    return [];
  }
}

/** Gates for a proposal whose epic already exists (e.g. created before gates were tracked). */
export async function createGatesForPage(pageId) {
  const record = await readVerdict(pageId);
  const epicKey = record?.epic?.key;
  if (!epicKey) return { error: 'Create the Jira epic first.' };
  const projectKey = epicKey.split('-')[0];
  const meta = await jiraRequest(route`/rest/api/3/issue/createmeta/${projectKey}/issuetypes`);
  const { storyTypeId } = pickIssueTypes(meta.issueTypes || meta.createMetaIssueType);
  const gates = await attachEpicAndGates({ pageId }, projectKey, record.epic, storyTypeId);
  return { created: gates.length };
}

// Guards against a second confirmation creating the same epic twice.
async function findRecentEpic(projectKey, epicTypeId, summary) {
  const data = await jiraRequest(route`/rest/api/3/search/jql`, {
    method: 'POST',
    body: JSON.stringify({
      jql: `project = ${projectKey} AND issuetype = ${epicTypeId} AND created >= -1d ORDER BY created DESC`,
      maxResults: 20,
      fields: ['summary'],
    }),
  });
  return (data.issues || []).find((i) => i.fields?.summary?.trim() === summary.trim()) || null;
}

export async function createJiraEpic(payload) {
  const projectKey = String(payload?.projectKey || '').trim().toUpperCase();
  if (!isValidProjectKey(projectKey)) return { error: 'Provide a valid Jira project key (e.g. SFD).' };
  const summary = String(payload?.epicSummary || '').trim().slice(0, 250);
  if (!summary) return { error: 'The epic needs a summary.' };
  const stories = parseStories(payload?.storiesList);

  try {
    const meta = await jiraRequest(route`/rest/api/3/issue/createmeta/${projectKey}/issuetypes`);
    const { epicTypeId, storyTypeId } = pickIssueTypes(meta.issueTypes || meta.createMetaIssueType);
    if (!epicTypeId) return { error: `Project ${projectKey} has no Epic issue type. Pick another project.` };

    const source = await proposalLink(payload);
    const browse = (key) => (source?.siteUrl ? `${source.siteUrl}/browse/${key}` : null);

    const existing = await findRecentEpic(projectKey, epicTypeId, summary);
    if (existing) {
      return { alreadyExists: true, epic: { key: existing.key, url: browse(existing.key) } };
    }

    const description =
      String(payload?.epicDescription || '') +
      (source ? `\n\nDecision record: [${source.title}](${source.url})` : '') +
      '\n\nCreated by Precedent after human review.';
    const epic = await jiraRequest(route`/rest/api/3/issue`, {
      method: 'POST',
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          issuetype: { id: epicTypeId },
          summary,
          description: textToAdf(description),
        },
      }),
    });

    let created = [];
    let failed = 0;
    if (stories.length && storyTypeId) {
      const bulk = await jiraRequest(route`/rest/api/3/issue/bulk`, {
        method: 'POST',
        body: JSON.stringify({
          issueUpdates: stories.map((s) => ({
            fields: {
              project: { key: projectKey },
              issuetype: { id: storyTypeId },
              parent: { key: epic.key },
              summary: s.summary,
              ...(s.details ? { description: textToAdf(s.details) } : {}),
            },
          })),
        }),
      });
      created = (bulk.issues || []).map((i) => ({ key: i.key, url: browse(i.key) }));
      failed = (bulk.errors || []).length;
    }

    const gates = await attachEpicAndGates(payload, projectKey, { key: epic.key, url: browse(epic.key) }, storyTypeId);
    return {
      epic: { key: epic.key, url: browse(epic.key) },
      stories: created,
      stageGates: gates.map((g) => ({ key: g.key, url: browse(g.key), due: g.due, criterion: g.criterion })),
      ...(failed ? { warning: `${failed} stories could not be created.` } : {}),
    };
  } catch (err) {
    console.error('createJiraEpic failed', err.message);
    return { error: friendlyError(err, 'create the Jira work items') };
  }
}

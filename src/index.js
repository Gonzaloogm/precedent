import api, { route } from '@forge/api';
import { storageToText, markdownToStorage, aiNoticePanel, stripLeadingTitle } from './lib/format.js';
import { sanitizeKeywords, isValidId, buildCql, buildJql } from './lib/search.js';
import { collectObjections, isReportTitle } from './lib/review.js';

const MAX_RESULTS = 5;
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
  throw new Error(`Atlassian API ${response.status}: ${detail.slice(0, 300)}`);
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
    return { error: `Could not read the page: ${err.message}` };
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
    return { error: `Could not read the proposal: ${err.message}` };
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
      fields: ['summary', 'status', 'resolution', 'issuetype', 'updated'],
    }),
  });
  const data = await readJson(response);
  return (data.issues || []).map((issue) => ({
    key: issue.key,
    summary: issue.fields?.summary,
    type: issue.fields?.issuetype?.name,
    status: issue.fields?.status?.name,
    resolution: issue.fields?.resolution?.name || null,
    updated: issue.fields?.updated,
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

export async function saveReport(payload) {
  const pageId = resolvePageId(payload);
  if (!pageId) return { error: 'Open the proposal page in Confluence, or provide its page ID.' };
  if (!payload?.reportMarkdown?.trim()) return { error: 'The report is empty.' };

  try {
    // Reports always hang off the proposal, even when the run started from another report.
    let parent = await fetchPage(pageId);
    if (isReportTitle(parent.title) && isValidId(parent.parentId)) parent = await fetchPage(parent.parentId);
    const baseTitle = (payload.reportTitle || `SprintFounders report - ${parent.title}`).slice(0, 200);
    const storage = aiNoticePanel() + markdownToStorage(stripLeadingTitle(payload.reportMarkdown));

    let response = await createChildPage(parent.spaceId, parent.id, baseTitle, storage);
    if (response.status === 400 || response.status === 409) {
      // Titles are unique per space: retry once with a timestamp.
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      response = await createChildPage(parent.spaceId, parent.id, `${baseTitle} (${stamp})`, storage);
    }
    const page = await readJson(response);
    return { saved: true, title: page.title, url: (page._links?.base || '') + (page._links?.webui || '') };
  } catch (err) {
    console.error('saveReport failed', err.message);
    return { error: `Could not save the report: ${err.message}` };
  }
}

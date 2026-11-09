// "Load sample company": creates a fictional company's history (Confluence space + Jira project)
// so the precedent check has something to find on a fresh site. Safe to run twice: everything that
// already exists is reused or skipped.
import api, { route } from '@forge/api';
import { markdownToStorage, escapeHtml } from './lib/format.js';
import { pickIssueTypes, textToAdf, isValidProjectKey } from './lib/jira.js';
import { templateFor, proposalTitle } from './lib/template.js';
import {
  SAMPLE_SPACE,
  SAMPLE_LABEL,
  SAMPLE_EPICS,
  SAMPLE_PROPOSAL_TITLE,
  SAMPLE_HOME,
  SAMPLE_HOME_MARKER,
  pagesToCreate,
  pickDoneTransition,
} from './lib/sample.js';

class ApiError extends Error {
  constructor(status, detail) {
    super(`Atlassian API ${status}: ${String(detail).slice(0, 300)}`);
    this.status = status;
  }
}

// Everything runs as the user, so Atlassian's own permissions decide what can be created.
async function call(product, path, options = {}) {
  const request = product === 'jira' ? api.asUser().requestJira : api.asUser().requestConfluence;
  const response = await request(path, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
  });
  if (response.status === 204) return null;
  if (response.ok) return response.json();
  throw new ApiError(response.status, await response.text());
}

const confluence = (path, options) => call('confluence', path, options);
const jira = (path, options) => call('jira', path, options);

function siteBase(links) {
  return (links?.base || '').replace(/\/wiki$/, '');
}

// ---------- Confluence ----------

async function findSpace() {
  const data = await confluence(route`/wiki/api/v2/spaces?keys=${SAMPLE_SPACE.key}&limit=${1}`);
  const space = data?.results?.[0];
  return space ? { ...space, siteUrl: siteBase(data._links) } : null;
}

async function createSpace() {
  const description = { value: SAMPLE_SPACE.description, representation: 'plain' };
  try {
    await confluence(route`/wiki/api/v2/spaces`, {
      method: 'POST',
      body: JSON.stringify({ name: SAMPLE_SPACE.name, key: SAMPLE_SPACE.key, description }),
    });
  } catch (err) {
    // The v2 endpoint only exists on sites with role-based access; fall back to v1.
    if (err.status !== 404 && err.status !== 400 && err.status !== 501) throw err;
    await confluence(route`/wiki/rest/api/space`, {
      method: 'POST',
      body: JSON.stringify({
        key: SAMPLE_SPACE.key,
        name: SAMPLE_SPACE.name,
        description: { plain: description },
      }),
    });
  }
  return findSpace();
}

// Replace the default "Welcome to your new space" homepage with the sample company intro.
async function writeHomepage(space) {
  if (!space.homepageId) return false;
  const home = await confluence(route`/wiki/api/v2/pages/${space.homepageId}?body-format=storage`);
  if ((home.body?.storage?.value || '').includes(SAMPLE_HOME_MARKER)) return false;
  await confluence(route`/wiki/api/v2/pages/${space.homepageId}`, {
    method: 'PUT',
    body: JSON.stringify({
      id: space.homepageId,
      status: 'current',
      title: SAMPLE_SPACE.name,
      body: { representation: 'storage', value: markdownToStorage(SAMPLE_HOME.markdown) },
      version: { number: (home.version?.number || 1) + 1, message: 'Precedent sample company' },
    }),
  });
  return true;
}

async function existingTitles(spaceId) {
  const data = await confluence(route`/wiki/api/v2/spaces/${spaceId}/pages?limit=${100}`);
  return (data?.results || []).map((p) => p.title);
}

async function createPage(space, page) {
  const created = await confluence(route`/wiki/api/v2/pages`, {
    method: 'POST',
    body: JSON.stringify({
      spaceId: space.id,
      ...(space.homepageId ? { parentId: space.homepageId } : {}),
      status: 'current',
      title: page.title,
      body: { representation: 'storage', value: markdownToStorage(page.markdown) },
    }),
  });
  for (const text of page.comments || []) {
    await confluence(route`/wiki/api/v2/footer-comments`, {
      method: 'POST',
      body: JSON.stringify({
        pageId: created.id,
        body: { representation: 'storage', value: `<p>${escapeHtml(text)}</p>` },
      }),
    });
  }
  return created;
}

// ---------- Jira ----------

// The sample history goes into a Jira project the user picks. Creating a project would need the
// manage:jira-project scope, and adding scopes to an installed app breaks Jira access for users
// who consented before, without Forge asking them again.
async function listProjects() {
  const data = await jira(route`/rest/api/3/project/search?maxResults=${50}&orderBy=${'name'}&action=${'create'}`);
  return (data?.values || []).map((p) => ({ key: p.key, name: p.name }));
}

async function sampleEpicSummaries(projectKey, epicTypeId) {
  const data = await jira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    body: JSON.stringify({
      jql: `project = ${projectKey} AND labels = ${SAMPLE_LABEL} AND issuetype = ${epicTypeId}`,
      maxResults: 50,
      fields: ['summary'],
    }),
  });
  return new Set((data?.issues || []).map((i) => i.fields?.summary));
}

async function closeIssue(key) {
  const data = await jira(route`/rest/api/3/issue/${key}/transitions`);
  const done = pickDoneTransition(data?.transitions);
  if (!done) return false;
  await jira(route`/rest/api/3/issue/${key}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: done.id } }),
  });
  return true;
}

async function seedEpic(projectKey, types, epic) {
  const created = await jira(route`/rest/api/3/issue`, {
    method: 'POST',
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        issuetype: { id: types.epicTypeId },
        summary: epic.summary,
        description: textToAdf(epic.description),
        labels: [SAMPLE_LABEL],
      },
    }),
  });
  let storyKeys = [];
  if (types.storyTypeId && epic.stories.length) {
    const bulk = await jira(route`/rest/api/3/issue/bulk`, {
      method: 'POST',
      body: JSON.stringify({
        issueUpdates: epic.stories.map((summary) => ({
          fields: {
            project: { key: projectKey },
            issuetype: { id: types.storyTypeId },
            parent: { key: created.key },
            summary,
            labels: [SAMPLE_LABEL],
          },
        })),
      }),
    });
    storyKeys = (bulk?.issues || []).map((i) => i.key);
  }
  // Past initiatives are finished: move everything to a done status.
  await Promise.all([...storyKeys, created.key].map((key) => closeIssue(key).catch(() => false)));
  return 1 + storyKeys.length;
}

// ---------- Resolver handlers ----------
// UI resolvers time out after 25 s, so the page runs the seed as small steps, one call each.

function friendly(err, fallback) {
  console.error('sample step failed', err.message);
  if (err.status === 401 || err.status === 403) return { ok: false, error: fallback.forbidden };
  return { ok: false, error: fallback.other };
}

export async function sampleStatus() {
  const result = { space: null, projects: [], jira: 'ok' };
  try {
    const space = await findSpace();
    if (space) result.space = { url: space.siteUrl + '/wiki/spaces/' + SAMPLE_SPACE.key };
  } catch (err) {
    console.error('sampleStatus space', err.message);
  }
  try {
    result.projects = await listProjects();
  } catch (err) {
    console.error('sampleStatus jira', err.message);
    result.jira = 'missing';
  }
  return result;
}

export async function seedSpace() {
  try {
    const space = (await findSpace()) || (await createSpace());
    if (!space) throw new Error('space missing after create');
    return { ok: true, siteUrl: space.siteUrl, spaceUrl: space.siteUrl + '/wiki/spaces/' + SAMPLE_SPACE.key };
  } catch (err) {
    return friendly(err, {
      forbidden: 'You need permission to create spaces in Confluence.',
      other: 'The sample space could not be created. Try again in a minute.',
    });
  }
}

export async function seedPages() {
  try {
    const space = await findSpace();
    if (!space) return { ok: false, error: 'The sample space does not exist yet.' };
    await writeHomepage(space);
    const missing = pagesToCreate(await existingTitles(space.id));
    for (const page of missing) await createPage(space, page);
    const pages = await confluence(route`/wiki/api/v2/spaces/${space.id}/pages?limit=${100}`);
    const proposal = (pages?.results || []).find((p) => p.title === SAMPLE_PROPOSAL_TITLE);
    return {
      ok: true,
      pagesCreated: missing.length,
      proposalUrl: proposal ? space.siteUrl + '/wiki' + proposal._links?.webui : null,
    };
  } catch (err) {
    return friendly(err, {
      forbidden: 'You need permission to add pages to the sample space.',
      other: 'Some sample pages could not be created. Run it again: existing pages are kept.',
    });
  }
}

export async function seedJiraEpic(projectKey, index) {
  const epic = SAMPLE_EPICS[Number(index)];
  if (!epic) return { ok: false, error: 'Unknown sample epic.' };
  if (!isValidProjectKey(projectKey)) return { ok: false, error: 'Pick a Jira project first.' };
  try {
    const meta = await jira(route`/rest/api/3/issue/createmeta/${projectKey}/issuetypes`);
    const types = pickIssueTypes(meta?.issueTypes || meta?.createMetaIssueType);
    if (!types.epicTypeId) return { ok: false, error: `Project ${projectKey} has no Epic work type. Pick another one.` };
    if ((await sampleEpicSummaries(projectKey, types.epicTypeId)).has(epic.summary)) return { ok: true, issuesCreated: 0 };
    return { ok: true, issuesCreated: await seedEpic(projectKey, types, epic) };
  } catch (err) {
    return friendly(err, {
      forbidden: 'You cannot create work items in the sample project.',
      other: 'A sample epic could not be created.',
    });
  }
}

// ---------- Proposal template ----------

export async function listSpaces() {
  try {
    const data = await confluence(route`/wiki/api/v2/spaces?type=${'global'}&status=${'current'}&limit=${50}&sort=${'name'}`);
    return { spaces: (data?.results || []).map((sp) => ({ id: sp.id, key: sp.key, name: sp.name, homepageId: sp.homepageId })) };
  } catch (err) {
    console.error('listSpaces failed', err.message);
    return { spaces: [] };
  }
}

export async function createProposal(spaceId, rawTitle, type) {
  const title = proposalTitle(rawTitle);
  if (!title) return { ok: false, error: 'Give the proposal a short title.' };
  if (!/^\d+$/.test(String(spaceId || ''))) return { ok: false, error: 'Pick a space.' };
  try {
    const space = await confluence(route`/wiki/api/v2/spaces/${spaceId}`);
    const created = await confluence(route`/wiki/api/v2/pages`, {
      method: 'POST',
      body: JSON.stringify({
        spaceId: String(spaceId),
        ...(space?.homepageId ? { parentId: space.homepageId } : {}),
        status: 'current',
        title,
        body: { representation: 'storage', value: markdownToStorage(templateFor(type)) },
      }),
    });
    return { ok: true, webui: created._links?.webui || '', base: siteBase(created._links) };
  } catch (err) {
    console.error('createProposal failed', err.message);
    if (err.status === 400 || err.status === 409) return { ok: false, error: 'A page with that title already exists in this space.' };
    if (err.status === 403) return { ok: false, error: 'You cannot add pages to that space.' };
    return { ok: false, error: 'The proposal could not be created. Try again in a minute.' };
  }
}

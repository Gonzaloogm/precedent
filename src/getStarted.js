// Resolver for the "Get started" pages in Confluence and Jira.
import Resolver from '@forge/resolver';
import { sampleStatus, seedSpace, seedPages, seedJiraEpic, listSpaces, createProposal } from './sample.js';
import { SAMPLE_EPIC_COUNT } from './lib/sample.js';

const resolver = new Resolver();
resolver.define('sampleStatus', async () => ({ ...(await sampleStatus()), epicCount: SAMPLE_EPIC_COUNT }));
resolver.define('seedSpace', () => seedSpace());
resolver.define('seedPages', () => seedPages());
resolver.define('seedJiraEpic', ({ payload }) => seedJiraEpic(String(payload?.projectKey || ''), payload?.index));

resolver.define('listSpaces', () => listSpaces());
resolver.define('createProposal', ({ payload }) => createProposal(payload?.spaceId, payload?.title));

export const handler = resolver.getDefinitions();

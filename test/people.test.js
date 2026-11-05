import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pageAri,
  titleKeywords,
  usersFromConnection,
  teamsFromConnection,
  pagePeople,
  whoToAsk,
  peopleSummary,
} from '../src/lib/people.js';

const CLOUD = 'fa8af3b8-b594-417e-9f9a-2a53a67a1911';
const user = (id, name) => ({ node: { __typename: 'AtlassianUser', id: `ari:cloud:identity::user/${id}`, name } });

test('pageAri validates its parts', () => {
  assert.equal(pageAri(CLOUD, '123'), `ari:cloud:confluence:${CLOUD}:page/123`);
  assert.equal(pageAri('nope', '123'), null);
  assert.equal(pageAri(CLOUD, '12; drop'), null);
});

test('titleKeywords drops the prefix and filler words', () => {
  assert.equal(titleKeywords('Proposal: AI scheduling assistant for clinics'), 'scheduling assistant clinics');
});

test('usersFromConnection keeps only named users', () => {
  const users = usersFromConnection({ edges: [user('1', 'Ana'), { node: { __typename: 'AtlassianTeam', id: 't' } }, {}] });
  assert.deepEqual(users, [{ id: 'ari:cloud:identity::user/1', name: 'Ana' }]);
  assert.deepEqual(usersFromConnection(null), []);
});

test('teamsFromConnection reads name or displayName', () => {
  assert.deepEqual(teamsFromConnection({ edges: [{ node: { name: 'Operations' } }, { node: { displayName: 'EHR' } }] }), [
    'Operations',
    'EHR',
  ]);
});

test('pagePeople lists the author once, then contributors', () => {
  const ana = { id: 'a', name: 'Ana' };
  const bo = { id: 'b', name: 'Bo' };
  assert.deepEqual(pagePeople([ana], [ana, bo]), [
    { id: 'a', name: 'Ana', role: 'author' },
    { id: 'b', name: 'Bo', role: 'contributor' },
  ]);
});

test('whoToAsk merges people across precedents in relevance order', () => {
  const precedents = [
    { title: 'SMS retro', url: 'u1', people: [{ id: 'x/b', name: 'Bo', role: 'contributor' }, { id: 'x/a', name: 'Ana', role: 'author' }] },
    { title: 'Portal decision', url: 'u2', people: [{ id: 'x/b', name: 'Bo', role: 'author' }] },
  ];
  const people = whoToAsk(precedents, { 'x/a': ['Operations'] }, 'a');
  assert.deepEqual(
    people.map((p) => [p.name, p.isViewer, p.pages.length]),
    [
      ['Ana', true, 1],
      ['Bo', false, 2],
    ]
  );
  assert.deepEqual(peopleSummary(people), [
    'Ana (Operations) [the person asking]: author of "SMS retro"',
    'Bo: contributor of "SMS retro"; author of "Portal decision"',
  ]);
});

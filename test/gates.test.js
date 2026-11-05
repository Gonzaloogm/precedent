import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dueDateFor,
  gateSummary,
  pageLabel,
  pageIdFromLabels,
  overdueGatesJql,
  gateState,
  missedGateMessage,
} from '../src/lib/gates.js';

test('dueDateFor adds days to the review date', () => {
  assert.equal(dueDateFor('2026-11-04T18:00:00Z', 30), '2026-12-04');
  assert.equal(dueDateFor('2026-12-20T00:00:00Z', 30), '2027-01-19');
  assert.equal(dueDateFor('nonsense', 30), null);
});

test('gate summary and page label round-trip', () => {
  assert.equal(gateSummary({ days: 30, criterion: '3 clinics sign up' }), 'Stage gate (day 30): 3 clinics sign up');
  assert.equal(pageIdFromLabels(['x', pageLabel('4718593')]), '4718593');
  assert.equal(pageIdFromLabels(['precedent-page-abc']), null);
  assert.equal(pageIdFromLabels(undefined), null);
});

test('overdue JQL skips done and already flagged gates', () => {
  const jql = overdueGatesJql();
  assert.match(jql, /labels = precedent-gate/);
  assert.match(jql, /labels != precedent-gate-missed/);
  assert.match(jql, /statusCategory != Done/);
});

test('gateState', () => {
  const today = '2026-12-10';
  assert.equal(gateState({ status: { statusCategory: { key: 'done' } }, duedate: '2026-12-01' }, today), 'done');
  assert.equal(gateState({ status: { statusCategory: { key: 'new' } }, duedate: '2026-12-01' }, today), 'missed');
  assert.equal(gateState({ status: { statusCategory: { key: 'new' } }, duedate: '2026-12-31' }, today), 'open');
  assert.equal(gateState(null, today), 'unknown');
});

test('missedGateMessage links the proposal', () => {
  const text = missedGateMessage(
    { summary: 'Stage gate (day 30): x', duedate: '2026-12-04' },
    { title: 'Proposal: X', url: 'https://s/wiki/p' }
  );
  assert.match(text, /due on 2026-12-04/);
  assert.match(text, /\[Proposal: X\]\(https:\/\/s\/wiki\/p\)/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAMPLE_PAGES,
  SAMPLE_EPICS,
  SAMPLE_PROPOSAL_TITLE,
  SAMPLE_SPACE,
  pagesToCreate,
  pickDoneTransition,
} from '../src/lib/sample.js';
import { markdownToStorage } from '../src/lib/format.js';
import { isReportTitle } from '../src/lib/review.js';

test('sample pages convert to clean storage and have unique titles', () => {
  const titles = SAMPLE_PAGES.map((p) => p.title.toLowerCase());
  assert.equal(new Set(titles).size, titles.length);
  for (const page of SAMPLE_PAGES) {
    const storage = markdownToStorage(page.markdown);
    assert.ok(storage.length > 100, page.title);
    assert.doesNotMatch(storage, /\*\*|^#/m, page.title);
    assert.equal(isReportTitle(page.title), false, page.title);
  }
});

test('exactly one sample proposal, with objections to rule on', () => {
  const proposals = SAMPLE_PAGES.filter((p) => p.proposal);
  assert.equal(proposals.length, 1);
  assert.equal(SAMPLE_PROPOSAL_TITLE, proposals[0].title);
  assert.ok(proposals[0].comments.length >= 2);
});

test('the precedent the demo relies on shares keywords with the proposal', () => {
  const proposal = SAMPLE_PAGES.find((p) => p.proposal).markdown.toLowerCase();
  const retro = SAMPLE_PAGES.find((p) => p.title.includes('SMS reminders')).markdown.toLowerCase();
  for (const word of ['no-show', 'sms', 'reception', 'gdpr']) {
    assert.ok(proposal.includes(word) || proposal.includes(word.replace('-', ' ')), word);
    assert.ok(retro.includes(word) || word === 'reception', word);
  }
});

test('sample space key is valid and epics have stories', () => {
  assert.match(SAMPLE_SPACE.key, /^[A-Z0-9]{1,255}$/);
  for (const epic of SAMPLE_EPICS) assert.ok(epic.summary && epic.description && epic.stories.length);
});

test('pagesToCreate skips existing titles, ignoring case', () => {
  const remaining = pagesToCreate([SAMPLE_PAGES[0].title.toUpperCase(), 'Unrelated']);
  assert.equal(remaining.length, SAMPLE_PAGES.length - 1);
  assert.equal(pagesToCreate(undefined).length, SAMPLE_PAGES.length);
});

test('pickDoneTransition picks by status category, not by name', () => {
  const transitions = [
    { id: '11', name: 'To Do', to: { statusCategory: { key: 'new' } } },
    { id: '21', name: 'Hecho', to: { statusCategory: { key: 'done' } } },
  ];
  assert.equal(pickDoneTransition(transitions).id, '21');
  assert.equal(pickDoneTransition([]), null);
  assert.equal(pickDoneTransition(undefined), null);
});

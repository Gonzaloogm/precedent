import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStories, pickIssueTypes, textToAdf, isValidProjectKey, adfToText, MAX_STORIES } from '../src/lib/jira.js';

test('parseStories reads bullets and numbered lines with optional details', () => {
  assert.deepEqual(parseStories('Intro\n- **Concierge test** | 2 clinics, 30 days\n2. Price model\n\n* A | b | c'), [
    { summary: 'Concierge test', details: '2 clinics, 30 days' },
    { summary: 'Price model', details: '' },
    { summary: 'A', details: 'b | c' },
  ]);
});

test('parseStories caps the number of stories and ignores empty summaries', () => {
  const many = Array.from({ length: 15 }, (_, i) => `- Story ${i}`).join('\n');
  assert.equal(parseStories(many).length, MAX_STORIES);
  assert.deepEqual(parseStories('- | only details'), []);
  assert.deepEqual(parseStories(undefined), []);
});

test('pickIssueTypes uses hierarchy levels, not names', () => {
  const types = [
    { id: '1', name: 'Subtarea', hierarchyLevel: -1, subtask: true },
    { id: '2', name: 'Tarea', hierarchyLevel: 0, subtask: false },
    { id: '3', name: 'Historia', hierarchyLevel: 0, subtask: false },
    { id: '4', name: 'Épica', hierarchyLevel: 1, subtask: false },
  ];
  assert.deepEqual(pickIssueTypes(types), { epicTypeId: '4', storyTypeId: '3' });
  assert.deepEqual(pickIssueTypes([{ id: '2', name: 'Task', hierarchyLevel: 0 }]), {
    epicTypeId: null,
    storyTypeId: '2',
  });
  assert.deepEqual(pickIssueTypes(undefined), { epicTypeId: null, storyTypeId: null });
});

test('textToAdf builds paragraphs, bullet lists, bold and links', () => {
  assert.deepEqual(textToAdf('Plan **now**\n- see [review](https://x.io/p)\n- two\n\nEnd'), {
    type: 'doc',
    version: 1,
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Plan ' }, { type: 'text', text: 'now', marks: [{ type: 'strong' }] }] },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'see ' },
                  { type: 'text', text: 'review', marks: [{ type: 'link', attrs: { href: 'https://x.io/p' } }] },
                ],
              },
            ],
          },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }] },
        ],
      },
      { type: 'paragraph', content: [{ type: 'text', text: 'End' }] },
    ],
  });
});

test('isValidProjectKey', () => {
  assert.equal(isValidProjectKey('SFD'), true);
  assert.equal(isValidProjectKey('sfd'), false);
  assert.equal(isValidProjectKey('X" OR 1=1'), false);
});

test('adfToText flattens and caps ADF', () => {
  const doc = textToAdf('Outcome: **cancelled**\n- 11% opt-in\n\nSee the retro');
  assert.equal(adfToText(doc), 'Outcome: cancelled\n11% opt-in\nSee the retro');
  assert.equal(adfToText(doc, 10), 'Outcome: c…');
  assert.equal(adfToText(null), '');
});

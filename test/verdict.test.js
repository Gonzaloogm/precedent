import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVerdict,
  parseScore,
  parseAxes,
  parseRulings,
  parseGates,
  buildVerdictRecord,
  bylineFor,
  withNewComment,
} from '../src/lib/verdict.js';

test('parseVerdict accepts only GO, PIVOT or STOP', () => {
  assert.equal(parseVerdict('pivot'), 'PIVOT');
  assert.equal(parseVerdict('**Verdict:** GO - fund it'), 'GO');
  assert.equal(parseVerdict('maybe'), null);
  assert.equal(parseVerdict(undefined), null);
});

test('parseScore clamps and rounds', () => {
  assert.equal(parseScore('52/100'), 52);
  assert.equal(parseScore(140), 100);
  assert.equal(parseScore('-3'), 0);
  assert.equal(parseScore('n/a'), null);
  assert.equal(parseScore('30', 25), 25);
});

test('parseAxes reads "name=score" pairs separated by ; or new lines', () => {
  assert.deepEqual(parseAxes('Team & execution fit=15; Timing: 12\n- Moat = 8'), [
    { name: 'Team & execution fit', score: 15 },
    { name: 'Timing', score: 12 },
    { name: 'Moat', score: 8 },
  ]);
  assert.deepEqual(parseAxes('nothing here'), []);
});

test('parseRulings keeps known rulings and marks the rest as noted', () => {
  assert.deepEqual(parseRulings('- upheld | Front desk workload\n- **Rejected** | Budget too low\n- Something else'), [
    { ruling: 'upheld', summary: 'Front desk workload' },
    { ruling: 'rejected', summary: 'Budget too low' },
    { ruling: 'noted', summary: 'Something else' },
  ]);
  assert.deepEqual(parseRulings('- partly upheld | EHR | 3x rule'), [{ ruling: 'partly upheld', summary: 'EHR | 3x rule' }]);
});

test('parseGates needs a day count and a criterion', () => {
  assert.deepEqual(parseGates('- 30 | 3 clinics sign up\n- 60 days | No-show below 10%\n- soon | vague'), [
    { days: 30, criterion: '3 clinics sign up' },
    { days: 60, criterion: 'No-show below 10%' },
  ]);
});

test('buildVerdictRecord returns null without a verdict', () => {
  assert.equal(buildVerdictRecord({ reportMarkdown: 'x' }), null);
});

test('buildVerdictRecord and bylineFor', () => {
  const record = buildVerdictRecord(
    {
      verdict: 'PIVOT',
      committeeScore: '52',
      axisScores: 'Team=15;Timing=12;Moat=8;Economics=17',
      objectionRulings: '- upheld | a\n- rejected | b',
      stageGates: '- 30 | x',
    },
    { title: 'Review', url: 'https://x/wiki/p' },
    new Date('2026-11-04T00:00:00Z')
  );
  assert.equal(record.verdict, 'PIVOT');
  assert.equal(record.score, 52);
  assert.equal(record.axes.length, 4);
  assert.equal(record.reviewedAt, '2026-11-04T00:00:00.000Z');
  assert.deepEqual(bylineFor(record), {
    title: 'Committee: PIVOT · 52',
    tooltip: '2 objections answered, 1 upheld. Click for details.',
  });
  assert.equal(bylineFor(null).title, 'SprintFounders');
});

test('withNewComment counts only comments after the review', () => {
  const record = { verdict: 'PIVOT', score: 55, reviewedAt: '2026-11-04T10:00:00Z', objections: [] };
  assert.equal(withNewComment(record, '2026-11-04T09:00:00Z'), null);
  const once = withNewComment(record, '2026-11-04T11:00:00Z');
  assert.equal(once.newComments, 1);
  assert.equal(withNewComment(once, '2026-11-04T12:00:00Z').newComments, 2);
  assert.equal(bylineFor(once).title, 'Committee: PIVOT · 55 · 1 new');
  assert.equal(withNewComment(null, '2026-11-05'), null);
});

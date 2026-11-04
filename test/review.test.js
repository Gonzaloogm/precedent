import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toObjection, collectObjections, isReportTitle, MAX_OBJECTIONS } from '../src/lib/review.js';

test('isReportTitle recognises pages saved by our agents', () => {
  assert.equal(isReportTitle('Market Research - Clinics (2026-11-04 10:00)'), true);
  assert.equal(isReportTitle("Devil's Advocate Review - Clinics"), true);
  assert.equal(isReportTitle('Proposal: AI scheduling assistant'), false);
  assert.equal(isReportTitle(undefined), false);
});

const comment = (html, extra = {}) => ({ body: { storage: { value: html } }, ...extra });

test('toObjection keeps the highlighted text of inline comments', () => {
  const raw = comment('<p>Too optimistic</p>', {
    properties: { inlineOriginalSelection: 'Viability: 63/100' },
    version: { createdAt: '2026-11-04T10:00:00Z' },
  });
  assert.deepEqual(toObjection('Report', raw, 'inline'), {
    page: 'Report',
    quote: 'Viability: 63/100',
    comment: 'Too optimistic',
    createdAt: '2026-11-04T10:00:00Z',
  });
});

test('toObjection skips resolved inline comments and empty bodies', () => {
  assert.equal(toObjection('P', comment('<p>x</p>', { resolutionStatus: 'resolved' }), 'inline'), null);
  assert.equal(toObjection('P', comment('<p> </p>'), 'footer'), null);
  assert.equal(toObjection('P', undefined, 'footer'), null);
});

test('footer comments have no quote, even if properties exist', () => {
  const raw = comment('<p>Why WhatsApp?</p>', { properties: { inlineOriginalSelection: 'x' } });
  assert.equal(toObjection('P', raw, 'footer').quote, null);
});

test('collectObjections sorts oldest first across pages and caps the total', () => {
  const objections = collectObjections([
    { pageTitle: 'B', footer: [comment('<p>second</p>', { version: { createdAt: '2026-11-02' } })] },
    { pageTitle: 'A', inline: [comment('<p>first</p>', { version: { createdAt: '2026-11-01' } })] },
  ]);
  assert.deepEqual(objections.map((o) => o.comment), ['first', 'second']);

  const many = Array.from({ length: 30 }, () => comment('<p>x</p>'));
  assert.equal(collectObjections([{ pageTitle: 'P', footer: many }]).length, MAX_OBJECTIONS);
});

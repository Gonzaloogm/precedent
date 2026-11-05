import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  trafficLight,
  lightReason,
  nextGate,
  portfolioRow,
  sortPortfolio,
  portfolioTotals,
} from '../src/lib/portfolio.js';

const gate = (state, due) => ({ state, due, days: 30, criterion: 'x' });

test('trafficLight: missed gates and STOP are red, PIVOT and new objections amber', () => {
  assert.equal(trafficLight({ verdict: 'GO' }, []), 'green');
  assert.equal(trafficLight({ verdict: 'GO' }, [gate('missed')]), 'red');
  assert.equal(trafficLight({ verdict: 'STOP' }, []), 'red');
  assert.equal(trafficLight({ verdict: 'PIVOT' }, [gate('open')]), 'amber');
  assert.equal(trafficLight({ verdict: 'GO', newComments: 2 }, []), 'amber');
});

test('lightReason explains the light', () => {
  assert.equal(
    lightReason({ verdict: 'GO' }, [gate('missed'), gate('missed')]),
    '2 stage gates missed: re-run the review',
  );
  assert.equal(lightReason({ verdict: 'GO', newComments: 1 }, []), '1 new objection since the review');
  assert.equal(lightReason({ verdict: 'PIVOT' }, []), 'Funded with conditions');
  assert.equal(lightReason({ verdict: 'GO' }, []), 'On track');
});

test('nextGate is the earliest open gate', () => {
  assert.equal(
    nextGate([gate('done', '2026-01-01'), gate('open', '2026-03-01'), gate('open', '2026-02-01')]).due,
    '2026-02-01',
  );
  assert.equal(nextGate([gate('missed', '2026-01-01')]), null);
});

test('portfolioRow, sorting and totals', () => {
  const a = portfolioRow(
    { id: '1', title: 'A', url: 'u' },
    { verdict: 'GO', score: 80, reviewedAt: '2026-11-01T10:00:00Z' },
    [],
  );
  const b = portfolioRow(
    { id: '2', title: 'B', url: 'u' },
    { verdict: 'PIVOT', score: 50, reviewedAt: '2026-11-03T10:00:00Z' },
    [gate('missed', '2026-11-02'), gate('done')],
  );
  assert.deepEqual(b.gates, { total: 2, done: 1, missed: 1 });
  assert.equal(b.reviewedAt, '2026-11-03');
  assert.deepEqual(
    sortPortfolio([a, b]).map((r) => r.id),
    ['2', '1'],
  );
  assert.deepEqual(portfolioTotals([a, b]), { red: 1, amber: 0, green: 1 });
});

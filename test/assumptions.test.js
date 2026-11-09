import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAssumptions,
  assumptionStates,
  assumptionsForGate,
  carryHistory,
  ledgerLines,
} from '../src/lib/assumptions.js';

test('parseAssumptions reads text and an optional gate day', () => {
  assert.deepEqual(
    parseAssumptions(
      '- Patients accept an AI assistant | 30\n- EHR integration | takes 2 months | day 60\n- Costs stay low',
    ),
    [
      { text: 'Patients accept an AI assistant', days: 30 },
      { text: 'EHR integration | takes 2 months', days: 60 },
      { text: 'Costs stay low', days: null },
    ],
  );
  assert.deepEqual(parseAssumptions(''), []);
});

test('assumptionStates follows the gate that tests each assumption', () => {
  const gates = [
    { days: 30, state: 'missed', key: 'X-1', due: '2026-11-19' },
    { days: 60, state: 'done', key: 'X-2' },
    { days: 90, state: 'open', key: 'X-3', due: '2027-02-03' },
  ];
  const states = assumptionStates(
    [
      { text: 'a', days: 30 },
      { text: 'b', days: 60 },
      { text: 'c', days: 90 },
      { text: 'd', days: null },
    ],
    gates,
  );
  assert.deepEqual(
    states.map((s) => s.state),
    ['disproved', 'confirmed', 'testing', 'untested'],
  );
  assert.equal(states[0].gateKey, 'X-1');
  assert.deepEqual(
    assumptionsForGate(
      [
        { text: 'a', days: 30 },
        { text: 'b', days: 60 },
      ],
      30,
    ),
    ['a'],
  );
});

test('carryHistory keeps resolved assumptions across re-runs', () => {
  const previous = {
    reviewedAt: '2026-11-04T10:00:00Z',
    assumptions: [
      { text: 'Patients accept AI', days: 30 },
      { text: 'Still open', days: 90 },
    ],
    history: [
      { text: 'patients accept ai', state: 'confirmed', reviewedAt: '2026-10-01' },
      { text: 'Old one', state: 'confirmed' },
    ],
  };
  const history = carryHistory(previous, [
    { days: 30, state: 'missed', key: 'X-1' },
    { days: 90, state: 'open' },
  ]);
  assert.deepEqual(history, [
    { text: 'Patients accept AI', state: 'disproved', gateKey: 'X-1', reviewedAt: '2026-11-04' },
    { text: 'Old one', state: 'confirmed' },
  ]);
  assert.deepEqual(carryHistory(null, []), []);
});

test('ledgerLines explains each state for the agents', () => {
  const lines = ledgerLines(
    [
      { text: 'a', state: 'disproved', gateKey: 'X-1', days: 30 },
      { text: 'b', state: 'testing', gateKey: null, days: 60, due: '2027-01-04' },
    ],
    [{ text: 'c', state: 'confirmed', reviewedAt: '2026-10-01' }],
  );
  assert.deepEqual(lines, [
    'DISPROVED (gate X-1 missed): a',
    'BEING TESTED (gate day 60 due 2027-01-04): b',
    'CONFIRMED in the review of 2026-10-01: c',
  ]);
});

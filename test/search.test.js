import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeKeywords, buildCql, buildJql, isValidId } from '../src/lib/search.js';

test('sanitizeKeywords removes quotes and operators, dedupes and caps', () => {
  assert.deepEqual(sanitizeKeywords('Dog "walking" OR) dog; app uber-style x'), [
    'dog',
    'walking',
    'app',
    'uber-style',
  ]);
  assert.equal(sanitizeKeywords('alpha beta gamma delta epsilon zeta theta').length, 6);
  assert.deepEqual(sanitizeKeywords(undefined), []);
});

test('sanitizeKeywords keeps accented words', () => {
  assert.deepEqual(sanitizeKeywords('logística café'), ['logística', 'café']);
});

test('buildCql excludes only numeric page ids', () => {
  assert.equal(
    buildCql(['dog', 'app'], '123'),
    'type = page AND (text ~ "dog" OR text ~ "app") AND id != 123'
  );
  assert.equal(
    buildCql(['dog'], '1 OR 1=1'),
    'type = page AND (text ~ "dog")'
  );
  assert.equal(buildCql([], '1'), null);
});

test('buildJql', () => {
  assert.equal(buildJql(['dog']), '(text ~ "dog") ORDER BY updated DESC');
  assert.equal(buildJql([]), null);
});

test('isValidId', () => {
  assert.equal(isValidId('42'), true);
  assert.equal(isValidId('4a'), false);
  assert.equal(isValidId(null), false);
});

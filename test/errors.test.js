import { test } from 'node:test';
import assert from 'node:assert/strict';
import { friendlyError } from '../src/lib/errors.js';

test('friendlyError hides API details', () => {
  const err = Object.assign(new Error('Atlassian API 404: {"errors":[...]}'), { status: 404 });
  const text = friendlyError(err, 'read the page');
  assert.match(text, /^I could not read the page: it no longer exists/);
  assert.doesNotMatch(text, /404|errors|API/);
});

test('friendlyError covers auth, rate limits, server errors and unknowns', () => {
  assert.match(friendlyError({ message: 'Authentication Required' }, 'x'), /Allow access/);
  assert.match(friendlyError({ status: 429 }, 'x'), /rate-limiting/);
  assert.match(friendlyError({ status: 503 }, 'x'), /temporary problem/);
  assert.match(friendlyError(new Error('boom'), 'x'), /^I could not x\. Try again/);
});

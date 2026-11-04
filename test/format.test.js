import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storageToText, markdownToStorage, escapeHtml } from '../src/lib/format.js';

test('storageToText strips tags, keeps structure and decodes entities', () => {
  const { text, truncated } = storageToText(
    '<h1>Idea</h1><p>Fish &amp; chips&nbsp;app</p><ul><li>one</li><li>two</li></ul>'
  );
  assert.equal(text, 'Idea\nFish & chips app\n\n- one\n- two');
  assert.equal(truncated, false);
});

test('storageToText truncates to the budget', () => {
  const { text, truncated } = storageToText('<p>' + 'a'.repeat(50) + '</p>', 10);
  assert.equal(text.length, 10);
  assert.equal(truncated, true);
});

test('storageToText handles empty input', () => {
  assert.deepEqual(storageToText(undefined), { text: '', truncated: false });
});

test('markdownToStorage converts headings, lists and inline marks', () => {
  const html = markdownToStorage('# Title\n**Verdict:** go\n\n- a *b*\n- [link](https://x.io)\n\n1. first');
  assert.equal(
    html,
    '<h1>Title</h1><p><strong>Verdict:</strong> go</p>' +
      '<ul><li>a <em>b</em></li><li><a href="https://x.io">link</a></li></ul>' +
      '<ol><li>first</li></ol>'
  );
});

test('markdownToStorage converts tables with a header row', () => {
  const html = markdownToStorage('| Axis | Score |\n|---|---|\n| Pain | 20 |');
  assert.equal(
    html,
    '<table><tbody><tr><th>Axis</th><th>Score</th></tr><tr><td>Pain</td><td>20</td></tr></tbody></table>'
  );
});

test('markdownToStorage escapes raw HTML from the model', () => {
  assert.equal(markdownToStorage('<script>x</script>'), '<p>&lt;script&gt;x&lt;/script&gt;</p>');
  assert.equal(escapeHtml('"&"'), '&quot;&amp;&quot;');
});

test('markdownToStorage ignores non-http links', () => {
  assert.equal(markdownToStorage('[x](javascript:alert(1))'), '<p>[x](javascript:alert(1))</p>');
});

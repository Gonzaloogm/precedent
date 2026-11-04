// Comment created on a Confluence page: if the page has a committee verdict, count the comment as
// a new objection so the byline badge and the panel suggest re-running the review. No LLM.
import { readVerdict, writeVerdict } from './index.js';
import { withNewComment } from './lib/verdict.js';
import { isValidId } from './lib/search.js';

export async function onComment(event) {
  if (event?.selfGenerated) return; // e.g. the app's own missed-gate comments
  const pageId = event?.content?.container?.id;
  if (event?.content?.container?.type !== 'page' || !isValidId(pageId)) return;
  try {
    const record = await readVerdict(pageId, 'app');
    const updated = withNewComment(record, event?.content?.history?.createdDate || event?.eventCreatedDate);
    if (updated) await writeVerdict(pageId, updated, 'app');
  } catch (err) {
    console.error('onComment failed', err.message);
  }
}

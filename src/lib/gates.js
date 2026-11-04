// Stage gates: the Devil's Advocate's 30/60/90-day stop criteria become Jira work items with a
// due date, and a daily check flags the ones that pass their date without being done.

export const GATE_LABEL = 'sprintfounders-gate';
export const OVERDUE_LABEL = 'sprintfounders-gate-missed';
const PAGE_LABEL_PREFIX = 'sprintfounders-page-';

export function dueDateFor(reviewedAt, days) {
  const d = new Date(reviewedAt);
  if (Number.isNaN(d.getTime()) || !Number.isFinite(days)) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function gateSummary(gate) {
  return `Stage gate (day ${gate.days}): ${gate.criterion}`.slice(0, 250);
}

/** The label that ties a gate to its proposal page, so the daily check can find it again. */
export function pageLabel(pageId) {
  return `${PAGE_LABEL_PREFIX}${pageId}`;
}

export function pageIdFromLabels(labels) {
  const label = (labels || []).find((l) => String(l).startsWith(PAGE_LABEL_PREFIX));
  const id = label ? label.slice(PAGE_LABEL_PREFIX.length) : '';
  return /^\d+$/.test(id) ? id : null;
}

/** JQL for gates past their due date, not done and not flagged yet. */
export function overdueGatesJql() {
  return `labels = ${GATE_LABEL} AND labels != ${OVERDUE_LABEL} AND duedate < startOfDay() AND statusCategory != Done ORDER BY duedate ASC`;
}

/** Status of one gate for the panel: done, missed (past due, not done) or open. */
export function gateState(fields, today = new Date().toISOString().slice(0, 10)) {
  if (!fields) return 'unknown';
  if (fields.status?.statusCategory?.key === 'done') return 'done';
  if (fields.duedate && fields.duedate < today) return 'missed';
  return 'open';
}

export function missedGateMessage(gate, proposal) {
  const link = proposal?.url ? ` [${proposal.title}](${proposal.url})` : ' the proposal';
  return (
    `Stage gate missed: "${gate.summary}" was due on ${gate.duedate} and is not done.\n\n` +
    `The committee recommends re-running the review on${link} before more budget is spent.\n\n` +
    'Posted by SprintFounders.'
  );
}

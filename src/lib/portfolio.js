// Portfolio: every reviewed proposal on one page, each with a traffic light that says whether
// the committee's decision still holds. Pure helpers; the API calls live in src/portfolio.js.

export const MAX_PROPOSALS = 25;
export const REVIEW_TITLE_CQL = 'type = page AND title ~ "Advocate Review" ORDER BY lastmodified DESC';

const LIGHT_ORDER = { red: 0, amber: 1, green: 2 };

/**
 * record: stored verdict. gates: record.gates merged with live Jira state (done / missed / open).
 * red   = STOP, or a stage gate was missed: stop spending until the committee looks again.
 * amber = PIVOT, or new objections since the review: the decision needs attention.
 * green = GO and on track.
 */
export function trafficLight(record, gates = record?.gates || []) {
  const missed = gates.filter((g) => g.state === 'missed').length;
  if (record?.verdict === 'STOP' || missed) return 'red';
  if (record?.verdict === 'PIVOT' || record?.newComments > 0) return 'amber';
  return 'green';
}

/** The plain-language reason behind the light, shown next to it. */
export function lightReason(record, gates = record?.gates || []) {
  const missed = gates.filter((g) => g.state === 'missed');
  if (missed.length) return `${missed.length} stage gate${missed.length > 1 ? 's' : ''} missed: re-run the review`;
  if (record?.verdict === 'STOP') return 'Stopped by the committee';
  if (record?.newComments > 0)
    return `${record.newComments} new objection${record.newComments > 1 ? 's' : ''} since the review`;
  if (record?.verdict === 'PIVOT') return 'Funded with conditions';
  return 'On track';
}

/** The next open gate by due date, or null. */
export function nextGate(gates) {
  return (
    gates
      .filter((g) => g.state !== 'done' && g.state !== 'missed' && g.due)
      .sort((a, b) => a.due.localeCompare(b.due))[0] || null
  );
}

export function portfolioRow({ id, title, url }, record, gates) {
  const done = gates.filter((g) => g.state === 'done').length;
  return {
    id,
    title,
    url,
    verdict: record.verdict,
    type: record.type || 'initiative',
    score: record.score ?? null,
    reviewedAt: (record.reviewedAt || '').slice(0, 10),
    light: trafficLight(record, gates),
    reason: lightReason(record, gates),
    gates: { total: gates.length, done, missed: gates.filter((g) => g.state === 'missed').length },
    next: nextGate(gates),
    epic: record.epic || null,
  };
}

/** Worst first, then most recently reviewed. */
export function sortPortfolio(rows) {
  return [...rows].sort(
    (a, b) => LIGHT_ORDER[a.light] - LIGHT_ORDER[b.light] || String(b.reviewedAt).localeCompare(String(a.reviewedAt)),
  );
}

export function portfolioTotals(rows) {
  return rows.reduce((t, r) => ({ ...t, [r.light]: t[r.light] + 1 }), { red: 0, amber: 0, green: 0 });
}

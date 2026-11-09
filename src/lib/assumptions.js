// Assumption ledger: the beliefs a verdict depends on, each tied to the stage gate that tests it.
// A met gate confirms its assumption, a missed gate disproves it. Resolved assumptions are kept
// across re-runs, so the committee remembers what it already learned about this proposal.

const MAX_ASSUMPTIONS = 8;
const MAX_HISTORY = 12;

const clip = (text, max = 240) =>
  String(text || '')
    .trim()
    .slice(0, max);

/** "- Patients will accept an AI assistant | 30" lines; the gate day is optional. */
export function parseAssumptions(raw) {
  return String(raw || '')
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((p) => p.trim());
      const last = parts.length > 1 ? parts.at(-1).match(/^(?:day\s*)?(\d{1,3})(?:\s*days?)?$/i) : null;
      const text = clip(last ? parts.slice(0, -1).join(' | ') : line);
      return text ? { text, days: last ? Number(last[1]) : null } : null;
    })
    .filter(Boolean)
    .slice(0, MAX_ASSUMPTIONS);
}

/** gates: the verdict's gates merged with live Jira state (done / missed / open). */
export function assumptionStates(assumptions, gates = []) {
  return (assumptions || []).map((a) => {
    const gate = a.days === null || a.days === undefined ? null : gates.find((g) => g.days === a.days);
    const state = !gate
      ? 'untested'
      : gate.state === 'done'
        ? 'confirmed'
        : gate.state === 'missed'
          ? 'disproved'
          : 'testing';
    return { text: a.text, days: a.days ?? null, state, gateKey: gate?.key || null, due: gate?.due || null };
  });
}

/** The assumptions a gate tests, for its Jira description. */
export function assumptionsForGate(assumptions, days) {
  return (assumptions || []).filter((a) => a.days === days).map((a) => a.text);
}

/**
 * On a re-run, keep what the previous review learned: its confirmed and disproved assumptions,
 * stamped with that review's date, ahead of older history.
 */
export function carryHistory(previous, previousGates) {
  if (!previous) return [];
  const resolved = assumptionStates(previous.assumptions, previousGates)
    .filter((a) => a.state === 'confirmed' || a.state === 'disproved')
    .map((a) => ({
      text: a.text,
      state: a.state,
      gateKey: a.gateKey,
      reviewedAt: (previous.reviewedAt || '').slice(0, 10),
    }));
  const seen = new Set(resolved.map((a) => a.text.toLowerCase()));
  const older = (previous.history || []).filter((h) => !seen.has(String(h.text).toLowerCase()));
  return [...resolved, ...older].slice(0, MAX_HISTORY);
}

const LABEL = { confirmed: 'CONFIRMED', disproved: 'DISPROVED', testing: 'BEING TESTED', untested: 'UNTESTED' };

/** Plain lines for the agents: what holds, what fell, what is still open. */
export function ledgerLines(states, history = []) {
  const current = (states || []).map((a) => {
    const how =
      a.state === 'confirmed'
        ? ` (gate ${a.gateKey || `day ${a.days}`} met)`
        : a.state === 'disproved'
          ? ` (gate ${a.gateKey || `day ${a.days}`} missed)`
          : a.state === 'testing'
            ? ` (gate ${a.gateKey || `day ${a.days}`} due ${a.due || 'later'})`
            : '';
    return `${LABEL[a.state]}${how}: ${a.text}`;
  });
  const past = (history || []).map(
    (h) =>
      `${LABEL[h.state] || 'NOTED'} in the review of ${h.reviewedAt || 'an earlier date'}${h.gateKey ? ` (gate ${h.gateKey})` : ''}: ${h.text}`,
  );
  return [...current, ...past];
}

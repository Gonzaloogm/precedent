import api, { route } from '@forge/api';
import { gateState } from './lib/gates.js';

// Live status of the gate work items, so closing a gate in Jira shows up here immediately.
export async function gateStatuses(gates) {
  const keys = (gates || []).map((g) => g.key).filter((k) => /^[A-Z][A-Z0-9_]+-\d+$/.test(k || ''));
  if (!keys.length) return {};
  const response = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ jql: `key in (${keys.join(',')})`, maxResults: keys.length, fields: ['status', 'duedate'] }),
  });
  if (!response.ok) return {};
  const data = await response.json();
  return Object.fromEntries(
    (data.issues || []).map((i) => [i.key, { state: gateState(i.fields), status: i.fields?.status?.name, ...(i.fields?.duedate ? { due: i.fields.duedate } : {}) }])
  );
}

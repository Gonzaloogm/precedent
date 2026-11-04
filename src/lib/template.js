// Proposal template: the sections the agents read best. Each prompt line tells the author what
// the committee will look for, so a weak section is visible before the review.

export const PROPOSAL_TEMPLATE = `**Requested by:** team or person. **Budget asked:** amount and period. **Team:** people and time.

## Problem
Who has the problem, how often, and what it costs today. Use numbers you can show.

## Proposed solution
What we will build, buy or change. Keep it to what the first version does.

## Who it is for
The first users or customers, as specific as possible. Who pays, if anyone.

## Success metrics
2 or 3 measurable targets with a date, e.g. "No-show rate from 14% to 7% in 6 months".

## Key assumptions
The beliefs that must be true for this to work. The committee will challenge these first.

## Risks
What could stop it: integrations, regulation, people, cost.

## What we already know
Links to earlier pages, retros or Jira work on this topic, if you know any. SprintFounders also searches for them.`;

export function proposalTitle(raw) {
  const title = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  if (!title) return null;
  return /^proposal:/i.test(title) ? title : `Proposal: ${title}`;
}

// Proposal templates: one per kind of budget request. Each prompt line tells the author what the
// committee will look for, so a weak section is visible before the review.

export const REQUEST_TYPES = {
  initiative: 'New product or service',
  campaign: 'Marketing campaign',
  tool: 'Tool or software purchase',
  hire: 'New hire or team',
  vendor: 'Vendor or supplier contract',
};

const header = (type) =>
  `**Request type:** ${REQUEST_TYPES[type]}. **Requested by:** team or person. **Budget asked:** amount and period. **Team:** people and time.`;

const COMMON_TAIL = `## Key assumptions
The beliefs that must be true for this to work. The committee will challenge these first.

## Risks
What could stop it: integrations, regulation, people, cost.

## What we already know
Links to earlier pages, retros or Jira work on this topic, if you know any. Precedent also searches for them.`;

const BODIES = {
  initiative: `## Problem
Who has the problem, how often, and what it costs today. Use numbers you can show.

## Proposed solution
What we will build, buy or change. Keep it to what the first version does.

## Who it is for
The first users or customers, as specific as possible. Who pays, if anyone.

## Success metrics
2 or 3 measurable targets with a date, e.g. "No-show rate from 14% to 7% in 6 months".`,

  campaign: `## Goal
What the campaign must achieve, as one number: bookings, leads, sign-ups or revenue.

## Audience and channel
Who we want to reach, where (search, social, email, events) and why that channel.

## Offer and message
What we offer and the one sentence the audience should remember.

## Success metrics
Cost per result and the target, e.g. "60 package bookings at under EUR 40 each in 8 weeks". How we will measure it.`,

  tool: `## Problem
What the team does today without the tool, how long it takes and what it costs.

## The tool
Which product, which plan, how many seats, and the price per month or year.

## Alternatives considered
Other products, building it ourselves, or doing nothing, and why this one.

## Success metrics
What changes after 90 days, e.g. "Month-end close from 6 days to 3".`,

  hire: `## Problem
What is not getting done today, and what it costs us.

## The role
Title, seniority, full-time or part-time, salary range and start date.

## Alternatives considered
Contractor, agency, moving work between people, or a tool instead.

## Success metrics
What this person must have delivered after 90 days and after 12 months.`,

  vendor: `## Problem
What we need from outside the company and why we cannot do it ourselves.

## The vendor and contract
Who, what they deliver, price, length of the contract and how we can exit it.

## Alternatives considered
Other vendors compared, and on what criteria.

## Success metrics
The service levels and results we will hold the vendor to.`,
};

export function requestType(raw) {
  return Object.hasOwn(REQUEST_TYPES, raw) ? raw : 'initiative';
}

export function templateFor(raw) {
  const type = requestType(raw);
  return `${header(type)}\n\n${BODIES[type]}\n\n${COMMON_TAIL}`;
}

/** The default template, used by the sample company. */
export const PROPOSAL_TEMPLATE = templateFor('initiative');

export function proposalTitle(raw) {
  const title = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  if (!title) return null;
  return /^proposal:/i.test(title) ? title : `Proposal: ${title}`;
}

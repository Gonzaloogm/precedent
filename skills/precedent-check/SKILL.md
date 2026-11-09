---
name: precedent-check
description: Finds what the company already tried before a new budget request is approved. Use it when someone proposes a product, campaign, tool, hire or vendor and asks whether it is a good idea, whether it was done before, or who to talk to.
license: MIT
allowed-tools: find-related-initiatives
---

# Precedent check

A new proposal is rarely the first attempt. Before judging it, find the closest earlier attempts in
the company's own Confluence pages and Jira work, and the people who were involved.

## How to search

1. Pick 3 to 6 distinctive keywords from the proposal: the problem, the channel or technology, and
   the customer. Avoid generic words such as "project", "new" or "plan".
2. Call `find-related-initiatives` with those keywords and the proposal's page ID, so the proposal
   itself is left out.
3. If nothing useful comes back, try once more with synonyms (for example "SMS" and "text
   message", or "ads" and "campaign").

## How to read the results

- Results come back by relevance. Lead with the closest precedent: a past attempt at the same
  problem matters more than anything else.
- Read each page's status and excerpt: cancelled, stopped, paused or shipped, and why.
- For Jira results, read the parent epic and its description. A finished story under a cancelled
  epic is a lesson from that failure, not reusable work.
- Only use results that share the proposal's customer, problem or solution. Leave the rest out.
- Never invent internal history. If nothing related exists, say so plainly.

## How to report

- For each relevant precedent: its title as a link, its outcome in one sentence, and what it means
  for the new proposal (a lesson, an overlap, a conflict, or work that can be reused).
- If the result includes `peopleWhoWereThere`, end with "Who to ask": up to 3 people, their team
  and the precedent they wrote or worked on. Use only those names. Leave out the person asking.

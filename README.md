# Precedent

**A skeptical investment committee inside Confluence and Jira that remembers what your company already tried.**

Teams pitch new initiatives and budget requests on Confluence pages every week. The committee that approves
them rarely remembers that a similar pilot was cancelled two years ago, or that the last EHR integration cost
three times the estimate. Precedent brings that memory into the review: its Rovo agents read the proposal,
search the company's own Confluence pages and Jira work for precedents, rule on every objection the team raises,
and give a clear GO, PIVOT or STOP with the conditions to keep going. When a plan is approved, they turn it into a
Jira epic with stage gates that are checked every day.

Built on Atlassian Forge for [Codegeist 2026](https://codegeist.devpost.com/), category *Apps for Business Teams*.

## How it works

1. **Write a proposal.** The *Get started* page creates a page from a template with the sections the committee
   reads: problem, solution, customer, success metrics, key assumptions and risks.
2. **Precedent Market Research** (Rovo agent) reads the page and writes a market report. It leads with the closest
   precedent from your own history, e.g. *"a 2025 SMS reminder pilot was cancelled after reaching 11% opt-in"*,
   and, through the **Teamwork Graph**, names the people who wrote or worked on it and their teams, so the
   proposer knows who to ask before asking for money.
3. **The team objects** with ordinary page comments.
4. **Precedent Devil's Advocate** (Rovo agent) rules on every objection (upheld, partly upheld, rejected), estimates the
   economics with the company's own budgeting rules, scores four axes and gives GO, PIVOT or STOP.
5. **The verdict stays on the page.** A byline badge shows `Committee: PIVOT · 55`; clicking it opens the
   committee panel with the scores, the rulings and the stage gates.
6. **Approved plans become Jira work.** The agent drafts an epic and stories and creates them after you confirm.
   Each stage gate becomes a work item with a due date under the epic.
7. **The committee keeps watching.** A daily check flags gates that passed their due date without being done,
   on the Jira item and on the proposal. A new comment after the verdict marks the badge `· 1 new` so the team
   knows the review is out of date. Re-running the review takes the missed gates and new objections into account.

Nothing is saved or created without the user's confirmation in chat.

## Try it

1. Install the app on a Confluence and Jira site (see *Install* below).
2. Open **Apps → Precedent** in Confluence and click **Load sample company**. It creates Brightpath Clinics,
   a fictional clinic network with past retros, a buy-vs-build decision and a proposal for an AI scheduling
   assistant. Optionally add its past initiatives to a Jira project you choose.
3. Open *Proposal: AI scheduling assistant for clinics*, open Rovo chat and ask **Precedent Market Research** to
   stress-test it. Then ask **Precedent Devil's Advocate** for the verdict and save it.

## Forge modules

| Module | Purpose |
|---|---|
| `rovo:agent` × 2 | Precedent Market Research and Precedent Devil's Advocate |
| `action` × 6 | Read the proposal, search precedents (CQL + JQL), read the review context, save reports, list Jira projects, create the epic and stories |
| `confluence:contentBylineItem` | Verdict badge on the proposal, read from a content property |
| `jira:issueContext` | The same committee panel on the epic, its stories and gates: why the work exists and whether it keeps its budget |
| `confluence:globalPage` | *Get started* page: sample company and proposal template (UI Kit) |
| `confluence:globalPage` *portfolio* | Every reviewed proposal with a traffic light: STOP or a missed gate is red, PIVOT or new objections amber |
| `scheduledTrigger` | Daily check of missed stage gates |
| `trigger` (`avi:confluence:created:comment`) | Marks the verdict out of date when new objections arrive |
| Teamwork Graph API (`requestTeamworkGraph`) | Creator, contributors and teams of each precedent ("Ask the people who were there") |

See [docs/architecture.md](docs/architecture.md) for the data flow.

## Privacy and permissions

- Agent actions call Confluence and Jira **as the user** (`asUser()`), so an agent only sees what that user can see.
- The daily gate check and the comment event run as the app and only touch pages and work items the app labelled.
- All data stays in the customer's Atlassian site: the verdict is a content property on the page and the gates are
  ordinary Jira work items. The app has no external backend and sends nothing outside Atlassian.

Scopes: `read:page`, `write:page`, `read:comment`, `write:comment`, `read:space`, `write:space`,
`search:confluence`, `read:confluence-content.summary`, `read:jira-work`, `write:jira-work`, and read-only
Teamwork Graph scopes `read:graph:page:confluence`, `read:graph:issue:jira`, `read:graph:user:atlassian`,
`read:graph:team:atlassian`.

## Install

Requires Node 22 or 24 (`nvm use` reads `.nvmrc`) and the Forge CLI.

```bash
npm install -g @forge/cli
forge login
npm install
forge register     # gives the app your own id in manifest.yml
forge deploy
forge install --product confluence
forge install --product jira
```

## Development

```bash
npm test           # unit tests (node:test)
forge lint
forge tunnel       # live reload against your site
```

```
manifest.yml               Forge modules, functions and scopes
resource/agent/prompts/    agent instructions
src/index.js               Rovo actions
src/committee.js           committee panel resolver
src/getStarted.js          Get started page resolver
src/gateCheck.js           daily missed-gate check
src/commentEvents.js       new-comment trigger
src/graph.js               Teamwork Graph queries (people on each precedent)
src/frontend/              UI Kit pages
src/lib/                   pure logic (search, verdict parsing, gates, sample data), covered by test/
```

## License

[MIT](LICENSE)

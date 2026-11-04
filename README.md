# SprintFounders for Confluence & Jira (Forge app)

A skeptical AI committee inside Confluence & Jira that stress-tests new initiatives against your
company's own history before you spend a cent.

## Current scope (week 1)

| Module | What it does |
|---|---|
| `rovo:agent` **SF Market Research** | Reads the proposal page, checks for similar past work, writes the market report |
| `action` `get-proposal` | Reads the current Confluence page as plain text (capped at 12k characters) |
| `action` `find-related-initiatives` | CQL + JQL search for similar pages and Jira issues ("déjà-vu check") |
| `action` `save-report` | Saves the report as a child page, **only after the user confirms** |

All API calls run `asUser()`, so the agent only ever sees what the user can see.

## Setup

Requires Node 22 or 24 (`nvm use` reads `.nvmrc`).

```bash
npm install -g @forge/cli
forge login          # needs an Atlassian API token: https://id.atlassian.com/manage/api-tokens
npm install
forge register       # replaces the placeholder app id in manifest.yml
forge deploy
forge install        # choose Confluence and your developer site
```

Then open any Confluence page, open Rovo chat and pick **SF Market Research**.

## Development

```bash
npm test             # unit tests (node:test, no dependencies)
forge lint
forge tunnel         # live reload against your site
```

## Cost

No paid services: the LLM is Rovo's (credits come from the site where the app is installed), and
the actions use Forge's free monthly allowance. Forge LLMs and Containers are not used because they
have no free tier.

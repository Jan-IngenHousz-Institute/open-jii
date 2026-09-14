---
name: openjii-linear
description: Read from and write to the openJII Linear workspace (team OJD) - look up a ticket or a project, search the backlog, read the private process documents, create an issue in the agreed shape, move it through the workflow, or link a PR. Use whenever work involves an OJD-#### ticket, a project, or the backlog.
---

# Working with Linear

Read `AGENTS.md` first. Linear is the source of truth for issues; GitHub Issues is a one-way mirror
fed from Linear. Never create a GitHub issue for tracked work.

`docs/agents/issue-tracker.md` holds the conventions. `docs/agents/ticket-standard.md` defines the
project shape, the three ticket shapes, the two gates and the prose bar.
`docs/agents/linear-taxonomy.md` defines the labels.

**This is a shared workspace with nine active members.** Reads are free. Writes are visible to
everyone immediately and Linear has no undo for a bulk change. Confirm before writing to anything
you did not create, and never write to more than one issue without saying what the sweep will touch.

## Access

One route: a personal API key, scoped, in `.claude/.env`. There is no MCP server in this repo. The
key works in subagents, background commands and CI, which interactive OAuth does not, and it gives
everyone the same recipe.

Mint a key at [Security and access](https://linear.app/settings/account/security), scoped to Read
plus Write and restricted to team `OJD`. Personal keys can be permission-scoped and team-scoped, so
do not issue a full-access one. Store it in `.claude/.env`, which `.gitignore` excludes twice:

```
LINEAR_API_KEY=lin_api_xxxxx
```

Load it only for the commands that need it, so it is not ambient in every shell:

```bash
set -a; . .claude/.env; set +a
```

The header is `Authorization: $LINEAR_API_KEY` with **no** `Bearer` prefix. Adding one gives a
silent 401. `@repo/devkit` commands read the same file.

The key is not set in every checkout. If it is missing, say so and ask rather than inventing one or
guessing at ticket contents.

## Conventions

- Ticket ids are `OJD-####`, written uppercase in prose.
- A bare `#42` is a **GitHub** number, not Linear. Resolve it with `gh pr view 42`, falling back to
  `gh issue view 42`.
- Every PR needs an `OJD-####` in its title, branch name, or body, or
  `.github/workflows/linear-ref-check.yml` fails it. Put it in the body's Linear issues section as
  `Closes OJD-####` or `Contributes to OJD-####`; that is what the release workflow reads. Branch
  names stay `<type>/<slug>` and carry no ticket ref.
- Projects are the unit of design. Every ticket has one. Creating a ticket without a project is a
  gate failure, not a shortcut.
- Closing as a duplicate is three writes: the relation, the state, a comment.
- No cycles, no estimation. Do not set estimates or look for a sprint.

## What the states mean

| Ticket state     | Meaning                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| `Backlog`        | Unrefined                                                                   |
| `Ready`          | Passes the ticket gate; anyone can pick it up                               |
| `In Progress`    | Started                                                                     |
| `In Review`      | PR open; the ticket carries `## How it was built` and `## Testing criteria` |
| `In Testing`     | Merged and live on dev; QA runs the testing criteria                        |
| `Ready For Prod` | Tested and signed off; waiting for a release                                |
| `Done`           | Live on production. Frozen; anything after is a new ticket                  |

Project statuses: `Backlog` (template started), `Planned` (passes the project gate), `In Progress`,
`Completed`, `Canceled`.

PR automation, once configured on the team, moves tickets to `In Progress`, `In Review` and
`In Testing` as the PR opens, is marked ready and merges. The production release workflow moves
shipped tickets to `Done`. **Refuse to move a ticket to `In Testing` yourself while either dev
section is empty**; point at `openjii-testing-criteria`.

## Query recipes

One ticket, with everything a decision needs:

```bash
curl -s https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" -H 'Content-Type: application/json' \
  -d '{"query":"query($id:String!){ issue(id:$id){ id identifier title description priorityLabel state{name} project{name} labels{nodes{name}} assignee{name} relations{nodes{type relatedIssue{identifier title state{name}}}} comments{nodes{body user{name}}} } }","variables":{"id":"OJD-1755"}}'
```

Search when you have words, not an id. A `searchableContent` filter matches poorly:

```bash
-d '{"query":"query($t:String!){ searchIssues(term:$t, first:10){ nodes{ identifier title state{name} project{name} } } }","variables":{"t":"device transfer organization"}}'
```

Projects. Keep nested `first` small; Linear caps query complexity at 10,000 and default page sizes
on every connection exceed it:

```bash
-d '{"query":"{ projects(first:50){ nodes{ id name state lead{name} targetDate description content projectMilestones(first:10){ nodes{ name } } } } }"}'
```

The private process documents, when a judgement call needs them:

```bash
-d '{"query":"{ documents(first:50){ nodes{ title url content } } }"}'
```

"Team Process" holds the Definition of Ready and Done and how the team works; "Critical Flows" holds
the smoke tests and tiers.

Create an issue. Resolve `teamId` and `projectId` once; a ticket without a project fails the gate:

```bash
-d '{"query":"mutation($in:IssueCreateInput!){ issueCreate(input:$in){ success issue{ identifier url } } }","variables":{"in":{"teamId":"<id>","projectId":"<id>","title":"...","description":"...","labelIds":["<type>","<area>"]}}}'
```

Move state, assign, or relabel with `issueUpdate($id:String!, $input:IssueUpdateInput!)`. Use
`addedLabelIds` and `removedLabelIds` rather than `labelIds`. The API takes ids, not names.

## Writing

Do not free-form a body. The project shape and the three ticket shapes in `ticket-standard.md` have
headings that skills parse, and the prose standard there is the last step before anything is
written. One ticket is `openjii-ticket-refine`; a project with its tickets is
`openjii-work-design`; the developer handoff is `openjii-testing-criteria`; bulk changes are
`openjii-backlog-triage`.

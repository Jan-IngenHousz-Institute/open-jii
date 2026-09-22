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

Two routes, chosen by the work rather than by preference.

**The devkit** is what every recipe below uses: a personal API key, scoped, held in the owner-only
`tooling/devkit/.env` and read only inside `@repo/devkit`. It works in subagents, background
commands and CI, which interactive OAuth does not, and it never enters a shell, a history file or
this context.

**Linear's MCP server** is optional and per-developer, good for looking up a ticket or making a
single write in an interactive session, and it stores no key at all. The repo ships no `.mcp.json`
and nothing here depends on one; whoever wants it adds it to their own configuration.

The split is not taste. The devkit refuses `*Delete` and `*Archive` mutations unless told otherwise,
refuses to read a webhook secret, and appends every mutation to `.claude/linear-writes.log`. An MCP
server has none of that, so a workspace where half the writes go through one keeps an incomplete
record. **Anything touching more than one ticket, anything running unattended, and anything that has
to be auditable goes through the devkit.**

The key belongs to the person. They mint it and store it themselves, following
`tooling/devkit/README.md`; an agent never mints, requests, reads or pastes one. Two situations
come up, and both are a message to the person, not something to work around:

- No key is found. The refusal names every path the devkit looked at. Say so and ask them to run
  `pbpaste | pnpm linear:auth` in the main checkout, which serves every worktree.
- A write fails with `Invalid scope`. The key was minted narrower than Write, most often without
  `comments:create`. Report which write failed and ask them to re-mint it with the Write scope.

Every call goes through the devkit. It resolves the key in-process (shell env, then this checkout's
env file, then the main worktree's, so one `linear:auth` serves every worktree), sends it bare in
the `Authorization` header (no `Bearer` prefix), refuses any `*Delete` or `*Archive` mutation
unless `--allow-destructive` is passed, and appends every mutation to `.claude/linear-writes.log`
with the session id and checkout that made it:

```bash
pnpm linear:query --query '{ viewer { name } }'
pnpm linear:query --file query.graphql --variables '{"id":"OJD-1755"}'
pnpm linear:query --query '{ viewer { name } }' --output .claude/viewer.json
```

Use `--output` whenever something parses the result: pnpm prints its own lines around stdout, so
reading the file is the only way to get clean JSON.

`--file` takes only a `.graphql` or `.gql` document, and the client refuses any selection of
`secret` or `clientSecret`: a webhook's signing secret is readable with a personal key and never
belongs in a transcript.

Never read `tooling/devkit/.env` or any other env file into the context. A hook blocks the obvious ways;
the rule covers the rest. If no key is found, say so and ask; do not invent one or guess at ticket
contents.

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
- Projects carry resources, as Linear documents on the project. `ticket-standard.md` names the
  standard set and the two rules they must meet. A ticket that touches a screen links the sketches
  itself, because the person picking it up reads the ticket and nothing else.
- Bookkeeping goes in a document or nowhere, never in a project update. Project updates are the
  status post the team reads in its feed.
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
shipped tickets to `Done`. **Refuse to move a work item or bug to `In Testing` yourself while
either dev section is empty**; point at `openjii-testing-criteria`. A spike has neither section and
skips `In Testing` altogether.

## Query recipes

One ticket, with everything a decision needs:

```bash
pnpm linear:query --query 'query($id:String!){ issue(id:$id){ id identifier title description priorityLabel state{name} project{name} labels{nodes{name}} assignee{name} relations{nodes{type relatedIssue{identifier title state{name}}}} comments{nodes{body user{name}}} } }' --variables '{"id":"OJD-1755"}'
```

Search when you have words, not an id. A `searchableContent` filter matches poorly:

```bash
pnpm linear:query --query 'query($t:String!){ searchIssues(term:$t, first:10){ nodes{ identifier title state{name} project{name} } } }' --variables '{"t":"device transfer organization"}'
```

Projects. Keep nested `first` small; Linear caps query complexity at 10,000 and default page sizes
on every connection exceed it:

```bash
pnpm linear:query --query '{ projects(first:50){ nodes{ id name state lead{name} targetDate description content projectMilestones(first:10){ nodes{ name } } } } }'
```

The private process documents, when a judgement call needs them:

```bash
pnpm linear:query --query '{ documents(first:50){ nodes{ title url content } } }'
```

"Team Process" holds the Definition of Ready and Done and how the team works; "Critical Flows" holds
the smoke tests and tiers.

The tickets in one project, and a team's states and labels with their ids, which every mutation
needs:

```bash
pnpm linear:query --query 'query($p:String!){ issues(first:50, filter:{ project:{ name:{ eqIgnoreCase:$p } } }){ nodes{ identifier title state{name} labels{nodes{name}} } } }' --variables '{"p":"Platform home and research discovery"}'
pnpm linear:query --query '{ teams(filter:{key:{eq:"OJD"}}){ nodes{ id states{ nodes{ id name } } } } issueLabels(first:100){ nodes{ id name } } }'
```

Create tickets with `pnpm linear:create <draft.md>`, which resolves team, project, state and
label names itself, rewrites cross-references, posts comments and sets relations. The raw mutation
is for a one-off; a ticket without a project fails the gate:

```bash
pnpm linear:query --query 'mutation($in:IssueCreateInput!){ issueCreate(input:$in){ success issue{ identifier url } } }' --variables '{"in":{"teamId":"<id>","projectId":"<id>","title":"...","description":"...","labelIds":["<type>","<area>"]}}'
```

Move state, assign, or relabel with `issueUpdate($id:String!, $input:IssueUpdateInput!)`. Use
`addedLabelIds` and `removedLabelIds` rather than `labelIds`. The API takes ids, not names. A
draft ticket headed by an identifier, `# OJD-1810 Home shows public research`, updates that ticket
through `linear:create` instead of creating one, which is the way to rewrite a body that already
exists.

A project's documents, uploads and shared view each have a command, so none of them needs a
hand-written mutation:

```bash
pnpm linear:document <file.md> --project "<name>" --title "<Project>: implementation deep dive"
pnpm linear:upload <file>
pnpm linear:view --project "<name>"
```

Each is a dry run until `--apply`. `linear:document` updates the document that already carries the
title, so republishing a corrected deep dive keeps its URL, and it refuses to write while a mermaid
block does not parse. The project body itself is still a `projectUpdate` mutation through
`linear:query`, which edits the body and is not the same thing as a project update post.

## Writing

Do not free-form a body. The project shape and the three ticket shapes in `ticket-standard.md` have
headings that skills parse, and the prose standard there is the last step before anything is
written. Draft in the file format from `tooling/devkit/README.md`, check with `pnpm linear:check`,
show the person the body, then create with `pnpm linear:create`. One ticket is
`openjii-ticket-refine`; a project with its tickets is `openjii-work-design`; the developer handoff
is `openjii-testing-criteria`; bulk changes are `openjii-backlog-triage`.

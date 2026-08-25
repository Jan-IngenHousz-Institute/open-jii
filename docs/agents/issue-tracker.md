# Issue tracker: Linear

Issues and specs live in **Linear**, team `OJD`, so tickets are `OJD-####`. GitHub Issues is a
synced mirror, not the source of truth: a ticket may exist in both places, and closing the GitHub
side is close-only. Status, labels and relations belong in Linear.

## Access routes

Pick by the shape of the work, not by convenience.

**Single read or write.** Use the Linear MCP server. It needs interactive authorization, through
the claude.ai connector settings or through `claude mcp` / `/mcp`. If it is unauthorized, say so
rather than guessing at ticket contents.

**Bulk operations**, meaning more than a handful of writes or any cross-ticket query. Call the
GraphQL API at `https://api.linear.app/graphql` directly with `LINEAR_API_KEY`. Do not use the MCP
server and do not fan out subagents: bulk through MCP is slow and loses atomicity. `LINEAR_API_KEY`
is not set in every checkout, so ask rather than inventing one.

## Conventions

- **Ticket ids are `OJD-####`.** Tooling matches them case-insensitively; write them uppercase in
  prose.
- **Every PR needs a ticket ref.** `.github/workflows/linear-ref-check.yml` fails a PR with no
  `OJD-####` in its title, branch name, or body. It exempts bot authors, the `no-linear` and
  `dependencies` labels, and `chore|build|fix(deps)` or `bump` titles. Prefer the branch name
  (`ojd-1541-filters-shelf`) so the ref survives a retitle.
- **`Done` means tested, not shipped.** After a PR merges, the default next status is `In Progress`,
  not `Done`. Deployment is tracked separately, through mobile tags and the `releaseProd-*` GitHub
  labels.
- **Closing as a duplicate is three writes** in Linear: set the duplicate relation, move the status,
  then comment. Doing only the status move loses the link.

## When a skill says "publish to the issue tracker"

Create a Linear issue on team `OJD`. Do not create a GitHub issue, because the sync runs Linear to
GitHub.

## When a skill says "fetch the relevant ticket"

Resolve the `OJD-####` id in Linear and read its description plus its comments. A bare `#42` in
this repo is a **GitHub** number, an issue or a PR, not a Linear id. Resolve it with
`gh pr view 42`, falling back to `gh issue view 42`.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature
requests; `/triage` reads this flag.)_

## Wayfinding operations

Used by `/wayfinder`. The **map** is a Linear parent issue and the **children** are its sub-issues.

- **Map**: a parent issue labelled `wayfinder:map`, holding the Notes, Decisions-so-far and Fog
  body.
- **Child ticket**: a sub-issue of the map, labelled `wayfinder:<type>`, one of `research`,
  `prototype`, `grilling` or `task`. Assign it to claim it.
- **Blocking**: Linear's native `blocks` and `blocked by` relations. A ticket is unblocked once
  every blocker sits in a completed or cancelled state.
- **Frontier query**: the map's incomplete sub-issues, dropping any with an unresolved blocker or an
  assignee. First in map order wins.
- **Claim**: assign the ticket to yourself. This is the session's first write.
- **Resolve**: comment the answer, move the ticket to a completed state, then append a context
  pointer to the map's Decisions-so-far.

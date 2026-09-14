# Issue tracker: Linear

Issues and specs live in **Linear**, team `OJD`, so tickets are `OJD-####`. GitHub Issues is a
synced mirror, not the source of truth: a ticket may exist in both places, and closing the GitHub
side is close-only. Status, labels and relations belong in Linear.

## Access

One route: a personal API key, scoped, in `.claude/.env`. There is no MCP server in this repo. The
key works in subagents, background commands and CI, which interactive OAuth does not, and it gives
everyone the same recipe. Setup is in the `openjii-linear` skill.

Call the GraphQL API at `https://api.linear.app/graphql` with `LINEAR_API_KEY`. Do not fan out
subagents for bulk work; one process with `issueBatchUpdate` is faster and keeps one record.

Mint the key at <https://linear.app/settings/account/security>, scoped to Read plus Write and
restricted to team `OJD`. Personal keys support permission and team scoping, so do not issue a
full-access one. Keep it in `.claude/.env`, which `.gitignore` excludes twice, and source it only for
the commands that need it. The header is `Authorization: <key>` with no `Bearer` prefix; adding one
gives a silent 401. `LINEAR_API_KEY` is not set in every checkout, so ask rather than inventing one.

## Projects, tickets, and what they contain

Everything lands on team `OJD`. A solution is designed as a **project**; the work is granularised
into **tickets** under it. `ticket-standard.md` defines the project shape, the three ticket shapes
(work item, bug, spike), the two gates and the prose bar. `linear-taxonomy.md` defines the labels.
Read those before writing anything rather than inventing a format.

The team's process (Definition of Ready, Definition of Done, how we work, the release flow) lives in
the Linear document "Team Process". It is private. Read it through the API when a judgement call
needs it; never port it into this repo.

The team runs **no cycles and no estimation**. Do not set estimates or look for a sprint.

## Conventions

- **Ticket ids are `OJD-####`.** Tooling matches them case-insensitively; write them uppercase in
  prose.
- **Every PR needs a ticket ref.** `.github/workflows/linear-ref-check.yml` fails a PR with no
  `OJD-####` in its title, branch name, or body. It exempts bot authors, the `no-linear` and
  `dependencies` labels, and `chore|build|fix(deps)` or `bump` titles. Put the ref in the body's
  Linear issues section (`Closes OJD-####`, `Contributes to OJD-####`); that is what the release
  workflow reads. Branch names stay `<type>/<slug>` and carry no ticket ref.
- **`Done` means live on production, and it is frozen.** A merged PR goes to `In Testing` (dev
  deploys on merge); `Ready For Prod` means tested and signed off; the production release workflow's
  `linear-release-action` moves shipped tickets to `Done`. Anything after that is a new ticket.
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

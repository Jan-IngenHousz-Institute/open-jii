---
name: openjii-backlog-triage
description: Sweep the OJD backlog for tickets and projects that fail the gates - no project, no type or area label, Ready without acceptance criteria, In Testing without testing criteria, projects missing template sections - and apply label, project and state changes in bulk from a reviewed change file. Use for the Monday review, a triage pass over new issues, the label taxonomy migration, or a relabel pass.
---

# Backlog triage

Read `AGENTS.md` first. Access and query recipes are in `openjii-linear`. The gates are in
`docs/agents/ticket-standard.md`. The label taxonomy and its change list are in
`docs/agents/linear-taxonomy.md`.

This skill writes labels, projects, states and one-line comments, to many issues at once, in a
workspace nine people share. It never writes or rewrites a description; that is
`openjii-ticket-refine` or `openjii-work-design`, one ticket at a time, with a person reading the
body.

**Always dry-run first.** Query, build the change list, show the user counts plus a sample, and
wait. Never let a sweep be the first thing the user hears about. Linear has no undo for a bulk
change, and relabelling silently breaks saved views other people rely on.

Use the GraphQL API in one process. Do not fan out subagents for a sweep; `issueBatchUpdate` is
faster and keeps one record of what changed.

## Finding what needs attention

One paginated query gets the open backlog. Exclude `duplicate` as well as `completed` and
`canceled`; it is its own state type and it inflates every count if left in.

```bash
pnpm linear:query --query 'query($after:String){ issues(first:250, after:$after, filter:{ team:{key:{eq:"OJD"}}, state:{type:{nin:["completed","canceled","duplicate"]}} }){ nodes{ id identifier title description state{name} project{name} labels{nodes{name}} } pageInfo{ hasNextPage endCursor } } }' --variables '{"after":null}'
```

Write the result to the scratchpad and analyse it there rather than re-querying.

Report, in this order:

| Gap                                                                                | Why it matters                                                                           |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| No project                                                                         | Invisible to every project view. Solution-shaped tickets in the maintenance bucket count |
| No `type` label, no `area` label                                                   | The ticket gate cannot pass; nothing can be counted or routed                            |
| In `Ready` but fails the ticket gate                                               | The state is lying, which is worse than `Backlog`                                        |
| In `In Testing` without `## Testing criteria`                                      | QA has nothing to run                                                                    |
| Project in `Planned` or later missing a template section, a lead, or a target date | The project gate is lying                                                                |
| Open, untouched for six months                                                     | Probably dead; ask before touching                                                       |

Unassigned is normal for backlog items. Do not report it.

For projects, query with small nested page sizes; Linear caps query complexity at 10,000 and a
project query with default `first` on every connection exceeds it.

## Triage decisions

For an untriaged issue, work down until one applies:

1. Not actionable, out of scope, or superseded: `wontfix` and cancel. A duplicate takes three
   writes: the relation, the state, a comment.
2. Cannot be judged without the reporter: `needs-info`, stays in `Backlog`.
3. Actionable but underspecified: `needs-triage` stays on; refinement is `openjii-ticket-refine`.
4. Passes the ticket gate and is mechanical enough for an unattended agent: `ready-for-agent`,
   move to `Ready`.
5. Passes the gate but needs judgement: `ready-for-human`, move to `Ready`.

The line for `ready-for-agent` is whether the acceptance criteria are checkable without asking
anyone a question.

Propose labels and projects. Do not invent acceptance criteria to push something over the gate.

## Applying the taxonomy

`pnpm linear:taxonomy` (in `@repo/devkit`) prints the diff between the workspace and the typed spec
that mirrors `linear-taxonomy.md`. `--apply --step <phase>` runs one phase, in this order, cheap
and reversible first:

1. `groups` and `creates`: additive, breaks nothing. The creates include team-scoped replacements
   for the six workspace-scoped labels that cannot be renamed into a team group.
2. `renames`: a rename keeps every issue attached. No cost.
3. `merges`: adds the target label to each source issue, verifies every issue carries it, then
   retires the source. An issue that already carries another label from the target's group is
   skipped and listed, and the source stays until those are settled by hand. The six scope-driven
   merges run here too.
4. `retires`: check saved views for `Migrated` first; it sits on 50 or more issues.

The command refuses `WBSO*`, `wayfinder:*` and the three labels marked undecided. Announce phases 3
and 4 to the team before running them.

## Relabel and re-project passes

For anything per-ticket (a type and area for each unlabelled ticket, a project for each orphan),
judgement goes into a change file and the write goes through `pnpm linear:apply`:

1. From the scratchpad data, propose per ticket from title, body and project. Write a JSON array of
   `{ "issueId", "identifier", "addedLabelIds", "removedLabelIds", "projectId", "stateId", "why" }`.
2. Show the user the counts, a sample, and the file path. Wait.
3. `pnpm linear:apply <file>` prints what it would do; `--apply` writes, grouped by identical
   update, chunked, logging each chunk. A partial failure leaves a record of where it stopped.

Resolve names to ids once at the start and reuse them. `issueBatchUpdate` takes issue UUIDs, not
`OJD-####`.

## Batch writes

`issueBatchUpdate` applies one `IssueUpdateInput` to a list of ids in one call. Use `addedLabelIds`
and `removedLabelIds`, which are additive; `labelIds` replaces the whole set and will strip labels
you meant to keep.

```bash
pnpm linear:query --query 'mutation($ids:[UUID!]!, $in:IssueUpdateInput!){ issueBatchUpdate(ids:$ids, input:$in){ success } }' --variables '{"ids":["<uuid>","<uuid>"],"in":{"addedLabelIds":["<id>"]}}'
```

Chunk large groups and check `success` on every response.

## Retiring a label

`issueLabelRetire`, never `issueLabelDelete`. Retiring hides the label while leaving it on the
issues that carry it; `issueLabelRestore` undoes it. Deleting strips history. The `WBSO*` series is
a compliance record; never delete those.

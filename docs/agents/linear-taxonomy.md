# Linear label taxonomy

The target label structure for team `OJD`, and the exact change list to get there from what exists
today. Nothing here has been applied. Applying it is a deliberate, reviewed step, because label
changes are visible to all nine team members and can break saved views and filters.

Read with `ticket-standard.md` (what a ticket contains) and `triage-labels.md` (the triage five).

`@repo/devkit` applies it: `pnpm linear:taxonomy` for this change list, `pnpm linear:apply` for the
per-ticket relabel pass that follows, both dry-run by default.

## Why groups

Linear label groups make their children mutually exclusive and render them as one facet. Today all
51 `OJD` labels are flat and mix at least six axes, so the type axis alone is spread across
`enhancement`, `Bug`, `Epic`, `research`, `Proposal`, `Feature` and `Improvement`. Grouping makes
"exactly one type" enforceable instead of conventional.

A grouped label's own name stays bare. Putting `needs-triage` under a `triage` group does not rename
it to `triage/needs-triage`, so anything matching on label strings keeps working.

Two facts about Linear shape the mechanics. An issue carries at most one label from a group and
there is no setting to change that, so a facet whose values must combine (`area`, `process`) stays
flat and is a naming convention, not a group. And 17 of the 51 labels are workspace-scoped while
`IssueLabelUpdateInput` has no `teamId`, so a workspace label cannot be renamed into a team group
through the API: it is recreated at team scope, added to its issues, and the old one retired. The
Linear UI can rescope labels in bulk; doing that by hand for the six affected labels first turns
those merges back into plain renames.

## Target structure

| Facet       | Linear group | Values                                                                                                                      |
| ----------- | ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `type`      | yes          | `bug`, `feature`, `improvement`, `spike`, `chore`                                                                           |
| `area`      | no           | `web`, `mobile`, `backend`, `data`, `infra`, `docs`, `design`                                                               |
| `triage`    | yes          | `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`                                               |
| `process`   | no           | `needs-design`, `needs-ux-check`, `ux-fix-needed`, `test-findings`, `approved-by-tester`, `blocked-external`, `help-wanted` |
| `wbso`      | no           | unchanged, see below                                                                                                        |
| `wayfinder` | no           | unchanged, see below                                                                                                        |

**`area` and `process` are flat facets, not groups.** Over 50 issues carry `Fullstack`, which means
web and backend together, and a ticket can be both `needs-ux-check` and `blocked-external`. A Linear
group allows one label each, so these two facets are a naming convention that the skills and the
sweep enforce.

**`wbso` is untouched.** `No-WBSO` and the `WBSO2025*` series drive Dutch R&D tax-credit reporting.
They are a compliance record, not workflow metadata. Do not rename, merge or archive them, and do
not retro-apply them.

**`wayfinder:*` is untouched.** The `/wayfinder` skill owns those strings and matches on them
verbatim.

## Change list

Counts are open-issue usage at the time of the audit. A count of `50` is the API page cap and means
"50 or more".

### Rename in place

A rename keeps every existing issue attached, so these are the cheap changes. Group assignment
happens at the same time. Only team-scoped labels can be renamed into a team group; the
workspace-scoped ones are in the merge table below.

| Today                | Becomes              | Facet     | Issues |
| -------------------- | -------------------- | --------- | -----: |
| `enhancement`        | `feature`            | `type`    |    50+ |
| `research`           | `spike`              | `type`    |     22 |
| `ci/cd`              | `infra`              | `area`    |     19 |
| `documentation`      | `docs`               | `area`    |     16 |
| `design`             | `design`             | `area`    |     21 |
| `needs_design`       | `needs-design`       | `process` |     10 |
| `Needs UX check`     | `needs-ux-check`     | `process` |     12 |
| `UX fix needed`      | `ux-fix-needed`      | `process` |     13 |
| `TestFindings`       | `test-findings`      | `process` |     11 |
| `ApprovedByTester`   | `approved-by-tester` | `process` |      5 |
| `Blocked - External` | `blocked-external`   | `process` |      5 |
| `help wanted`        | `help-wanted`        | `process` |      3 |

### Create

| Label             | Group    | Why                                                 |
| ----------------- | -------- | --------------------------------------------------- |
| `chore`           | `type`   | Dependency bumps and maintenance have no type today |
| `needs-triage`    | `triage` | Documented in `triage-labels.md`, never created     |
| `needs-info`      | `triage` | as above                                            |
| `ready-for-agent` | `triage` | as above, and it is what gates AFK agent work       |
| `ready-for-human` | `triage` | as above                                            |
| `wontfix`         | `triage` | as above                                            |

The five `triage` labels are the gap between `triage-labels.md` and reality. That file documents
them as existing additions. They do not exist. Any skill trusting it today is working from fiction.

The six workspace-scoped labels in the merge table are also created at team scope first (`bug`,
`improvement`, `web`, `mobile`, `backend`, `data`), which is where the dry run's twelve creates come
from.

### How to archive

"Archive" below means `issueLabelRetire`, never `issueLabelDelete`. Retiring hides a label from
pickers while leaving it attached to the issues that already carry it, and `issueLabelRestore` undoes
it. Deleting is permanent and strips the label from every issue. Never delete the `WBSO*` series:
that history is a compliance record.

### Merge, then archive

Reassign the issues to the target label first, then archive the source. Each of these is either a
genuine duplicate on an axis that should carry one value, or a workspace-scoped label that cannot be
moved into a team group. An issue that already carries another label from the target's group (a
`Bug` that is also `enhancement`, say) is skipped and listed rather than having one label silently
replaced; the source stays until a person settles those, then the phase is rerun.

| Source           | Issues | Target                                 |
| ---------------- | -----: | -------------------------------------- |
| `Bug`            |     31 | `bug`, recreated at team scope         |
| `Improvement`    |      6 | `improvement`, recreated at team scope |
| `Web`            |     36 | `web`, recreated at team scope         |
| `Mobile`         |    50+ | `mobile`, recreated at team scope      |
| `Backend`        |     23 | `backend`, recreated at team scope     |
| `Data`           |     14 | `data`, recreated at team scope        |
| `Feature`        |      3 | `feature`                              |
| `python`         |      3 | `data`                                 |
| `python:uv`      |      1 | `data`                                 |
| `Devops testing` |      8 | `infra`                                |
| `Fullstack`      |    50+ | `web` **and** `backend`                |

### Archive outright

| Label               | Issues | Why                                                                         |
| ------------------- | -----: | --------------------------------------------------------------------------- |
| `Blog`              |      0 | Content axis, never used, belongs to a marketing surface                    |
| `Case Study`        |      0 | as above                                                                    |
| `Event`             |      0 | as above                                                                    |
| `Newsletter`        |      0 | as above                                                                    |
| `Social`            |      0 | as above                                                                    |
| `Whitepaper`        |      0 | as above                                                                    |
| `Changelog`         |      1 | as above                                                                    |
| `question`          |      0 | Never used                                                                  |
| `Ignored_by_Romy`   |      0 | Personal filter, never used                                                 |
| `Most Urgent`       |      4 | Linear's priority field already does this                                   |
| `Roughly_estimated` |      2 | Estimation is off at team level                                             |
| `to_Refine`         |      7 | Replaced by the `Backlog` / `Ready` boundary and the DoR                    |
| `Migrated`          |    50+ | Residue from an import. Carries no current meaning                          |
| `Epic`              |     28 | Projects are the container. Retire after the three open epics are converted |

`Migrated` is the one to check before archiving: it is on 50 or more issues, so confirm nobody has a
saved view filtering on it.

### Needs a decision first

| Label      | Issues | The question                                                                                                                                             |
| ---------- | -----: | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Platform` |     32 | Is this an area distinct from `web`, or an older name for it? It overlaps `Web` (36) and `Fullstack` (50+) and cannot be mapped without knowing which.   |
| `Proposal` |     12 | Is this a ticket type (a proposed feature) or a state (proposed, not yet accepted)? If a state, it belongs in `triage` as `needs-triage`, not in `type`. |
| `planning` |      3 | Too vague to place. Read the three issues and either fold them in or archive.                                                                            |

## Net effect

51 flat labels become roughly 35 across two groups and four facets, with no issue losing a label it
meaningfully carried. Eleven of the changes are renames, which cost nothing and break nothing; eleven
are merges, six of them only because of label scope. `pnpm linear:taxonomy` prints the exact list
against the live workspace before anything is applied.

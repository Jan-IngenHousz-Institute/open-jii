# Ticket standard

The tooling contract for team `OJD`: what a project and a ticket contain, the two gates a script can
check, what each state means, and the prose bar for anything an agent writes into Linear. Skills
parse the headings below, so a renamed heading breaks tooling rather than just looking different.

The team's process itself (Definition of Ready, Definition of Done, how we work, the release flow)
is private and lives in the Linear document
[Team Process](https://linear.app/openjii/document/team-process-2055546cf0e2). Read it from there
when a judgement call needs it; do not copy it into this repo.

Read with `issue-tracker.md` (access and conventions) and `linear-taxonomy.md` (labels).

## Projects are the unit of design

Everything lands on team `OJD`. A solution is designed as a **project**; the work is granularised
into **tickets** under that project. There are no epics: a container is a project, and ticket
sub-types beyond the three shapes below do not matter. Milestones sequence work inside a project
only where order matters; they are not a second project layer.

Every ticket belongs to exactly one project. `openJII Development` is the maintenance bucket for
bugs and chores with no solution home, and its scope line says so. A solution-shaped ticket that
fits no project is a signal that the project is missing, not that the bucket is right.

## Project shape

One template, fixed headings, under 2,500 characters. The one-line `description` field is the
outcome in a sentence. Lead, priority, target date and team `OJD` are set when the project reaches
`Planned`.

```markdown
## Problem

Who has it, what happens today, why it matters now.

## Outcome

What is true when this is done. One paragraph.

## Non-goals

What this deliberately does not cover.

## Design

Links: design canvas, ADR, contract changes in `packages/api`. A short system design or a pointer.
The precedent in the codebase this follows.

## Deliverables

The tickets, in intended order. Milestones named here if order matters.

## Done when

Observable checks, and who accepts: the person who requested it, or the technical approver named
in the Team Process document.

## Risks and dependencies
```

Nothing in the body about which agent created it, when the container was made, or which issues
were inventoried. That is bookkeeping and it goes in a comment or nowhere.

### Project lifecycle

| Status        | Meaning                                     | Leaves it when                                                           |
| ------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| `Backlog`     | An idea with the template started           | it passes the project gate                                               |
| `Planned`     | Designed and granularised                   | the first ticket starts                                                  |
| `In Progress` | Work under way                              | every ticket is `Done` and "Done when" is verified by the named acceptor |
| `Completed`   | Live and accepted                           | terminal                                                                 |
| `Canceled`    | Dropped, with a one-line reason in the body | terminal                                                                 |

**Project gate** (`Backlog` to `Planned`), checkable by a script: every heading above present and
non-empty, a lead, a target date, at least one ticket in `Ready`, and a design link under
`## Design` when the work is user-facing.

## Ticket shapes

Three. Headings are fixed; everything under a heading is free prose.

### Work item

The default, ported from `.github/ISSUE_TEMPLATE/user_story.md`. A feature, an improvement, or any
change a user would notice.

```markdown
## User story

**WHO:** the user role or persona
**WHAT:** the required functionality
**WHY:** the business or user benefit

## Acceptance criteria

- conditions that must hold for this to be complete
- primary flow, plus the alternative flows that matter
- the business rules that apply

## Dependencies and risks

## Additional context

Links, design canvas, the precedent this follows, suggested implementation.

## How it was built

Empty until the developer fills it before review.

## Testing criteria

Empty until the developer fills it before review.
```

### Bug

Ported from `.github/ISSUE_TEMPLATE/bug_report.md`.

```markdown
## Observed

## Expected

## Reproduction

1. Go to ...
2. Click ...
3. See ...

## Environment

Platform, browser or device, version, account or organization if it matters.

## Evidence

Screenshots, logs, request ids.

## How it was built

## Testing criteria
```

### Spike

Work whose output is an answer, not a change.

```markdown
## Question

## Why now

What decision is blocked until this is answered.

## Timebox

A number of days. A spike without a timebox is a project.

## Done when

The artefact that ends it: an ADR, a comment on the project, a prototype branch.
```

## Ticket gate

A ticket may leave `Backlog` for `Ready` only when all of these hold. Skills check them; a sweep
reports any `Ready` ticket that fails.

- one `type` label
- at least one `area` label
- a project
- a non-empty `## Acceptance criteria` (or `## Done when`, for a spike)
- no unresolved blocking relation

The judged half (INVEST, the acceptance-criteria bar, attached designs for frontend work) is in the
Team Process document. Two readings the team uses, since it runs neither cycles nor estimation:
"Small" means one person can carry it to `Ready For Prod` without splitting, and "Estimable" means
someone could say whether that is true. A ticket that fails either is split, not estimated.

## Testing gate

A work item or bug may enter `In Testing` only with a non-empty `## How it was built` and
`## Testing criteria`. The developer writes both before marking the PR ready for review, through
the `openjii-testing-criteria` skill; the PR checklist makes the reviewer confirm they exist; the
triage sweep lists any `In Testing` ticket that slipped through. `openjii-linear` refuses a manual
move without them.

A spike carries neither section, since its shape has neither, and it skips `In Testing`. It is
accepted when the artefact named in its `## Done when` exists, which is the one case where `Done`
means accepted rather than deployed.

Testing criteria are written for someone who did not build the change (the requester, the TPM, or
the intern) and read like the smoke tests in the Critical Flows document:

```markdown
## Testing criteria

Environment: dev, web. Needs two organizations where you are admin of both.
Touches Critical Flows tier 2.

1. Org A > Devices > "Field kit" > Transfer. Expected: the picker lists only org B.
2. Confirm. Expected: the group is gone from org A on reload and present in org B with the same
   device count.
3. As a plain member of org A, open the old group URL. Expected: the refused-access page.
4. Negative: as admin of A but not B, the Transfer action is absent.
```

## Ticket lifecycle

The nine `OJD` states encode the four phases of the Definition of Done, which is why the pipeline
is longer than a default Linear board.

| State            | Meaning                                            | Leaves it when                                                  |
| ---------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| `Backlog`        | Unrefined                                          | it passes the ticket gate                                       |
| `Ready`          | Someone can pick it up without hunting for context | someone starts it                                               |
| `In Progress`    | Started                                            | the PR is ready for review, with both dev sections filled       |
| `In Review`      | PR open                                            | review is approved and the PR merges                            |
| `In Testing`     | Merged and live on dev                             | QA runs the testing criteria and signs off                      |
| `Ready For Prod` | Tested and signed off, waiting for a release       | the production release workflow completes                       |
| `Done`           | Live on production. Frozen                         | terminal; anything after is a new ticket                        |
| `Canceled`       | Dropped                                            | terminal                                                        |
| `Duplicate`      | Superseded                                         | terminal, and needs the duplicate relation, not just the status |

PR automation, once configured on the team, moves a ticket to `In Progress` when a branch or PR
opens, to `In Review` when the PR is marked ready, and to `In Testing` on merge. The release
workflow's `linear-release-action` moves shipped tickets to `Done`. The UX check stays label-driven
(`needs-ux-check`, `ux-fix-needed`); there is no `In Design Check` state.

## Prose standard

The last step of every skill that writes to Linear. These rules come from the failure modes in this
workspace's own agent-written tickets, not from a generic style guide.

1. Headings are exactly the shape's. No extra sections, no date-stamped headings.
2. Budgets, excluding the two dev-filled sections: work item under 1,200 characters, bug under
   800, spike under 600, project body under 2,500. Over budget means a split, or the detail goes to
   a comment, a linked document, or nowhere.
3. One idea per bullet, under 25 words. A bullet that needs a second sentence is two bullets.
4. Persona first, in WHO, and again in acceptance criteria where it matters: "an org admin can",
   "a plain member sees".
5. Open questions are expected. "Open: does this apply to archived experiments? Ask the TPM." beats
   resolving it by assertion.
6. No investigation narrative. What was checked or corrected on a date is a comment. The body says
   what is true now and what should be built.
7. No orders about what not to build. Say what to build; name the precedent under Additional
   context or Design.
8. Implementation detail is a suggestion and lives under Additional context or Design as
   "Suggested:". Never in acceptance criteria, which describe observable behaviour only.
9. No bookkeeping in the body: no "canonical owner of", "absorbs", "initial issue inventory",
   "project container (date)". Relations are set in Linear, with one line in a comment if needed.
10. No authorship banner. If a person has not read and edited the text, it is not ready.
11. At most one "X, not Y" sentence per body.
12. Titles say what the user can do or what is broken, under 70 characters, no type prefix
    (`DISCOVERY:` is a label, not a title), no list of three. Project names are the outcome in
    three to six words.
13. Then the `unslop` skill.

Mechanical check before showing the body: heading set equals the shape, length within budget,
longest bullet under 25 words, zero em dashes, no banner, at most one "not" clarification. Then
`unslop`. A failed check stops the write; fix the body first. Then the person reads it. Nothing is written
to Linear that a person has not read.

## Relation to the GitHub templates

GitHub Issues is a synced mirror fed from Linear, so `.github/ISSUE_TEMPLATE/` only serves people
filing directly on GitHub, mostly external contributors. Those templates stay and their headings
match the shapes above, so a synced issue parses the same on both sides.

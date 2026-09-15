---
name: openjii-work-design
description: Take an idea from a sentence to a designed Project with its tickets in Linear - frame the problem, ground it in the existing codebase, design the solution as a visual canvas or a written system design, record the decision if it is contested, then write the project in the template shape and granularise it into tickets. Use when conceptualising a feature, designing a solution before implementation, or planning any body of work larger than one ticket.
---

# From idea to a designed project

Read `AGENTS.md` first. The project shape, the ticket shapes, both gates and the prose standard are
in `docs/agents/ticket-standard.md`; read it before writing anything. Writing a single ticket is the
`openjii-ticket-refine` skill. Access and query recipes are in `openjii-linear`.

The unit of design is a Linear **project**. There are no epics. A project holds the design; its
tickets hold the work.

Five stages, one outcome each. Skip a stage deliberately, not by drifting past it. Small work
legitimately skips stages 3 and 4.

| Stage                  | Outcome                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| 1. Frame               | A problem statement: who, what, why, and what is out of scope                |
| 2. Ground              | The in-repo precedent this will follow, named by file                        |
| 3. Design              | A design canvas, a written system design, or both                            |
| 4. Record              | An ADR, only when the decision was contested                                 |
| 5. Project and tickets | A project in the template shape, with tickets under it, shown before writing |

## 1. Frame

Pin down who this is for, what changes for them, and why it is worth doing now. The persona is a
real one: researcher, org admin, field operator, platform operator. "The user" is not a persona.

State the non-goals. They stop stage 3 from sprawling and they become the project's `## Non-goals`
verbatim.

Search Linear before going further: projects by name, then `searchIssues` on two or three of the
user's own words. A backlog this old often already holds the idea. If a project exists, this skill
extends it rather than opening a second one.

Read the Team Process document in Linear once per session (recipe in `openjii-linear`). It holds
the Definition of Ready and who accepts what.

## 2. Ground in what exists

**This is the stage that gets skipped, and skipping it produces designs that do not fit the
codebase.** The repo has strong conventions and a sibling for almost everything.

Read, in this order: `CONTEXT.md` at the root, the ADRs under
`apps/docs/content/developers/design-decisions/` that touch this area, `apps/mobile/CONTEXT.md` for
mobile work, then the closest existing implementation.

Name the precedent out loud: "this follows `experiment-overview`, mirroring how `device-groups`
handles org scoping". A design that cannot name its sibling is usually inventing something the
project already has.

Two standing rules a design must not quietly break. UI comes from precedent, not invention: find
the component that already solves the interaction and mirror it. Backend work mirrors a sibling
domain wholesale rather than inventing a new arrangement of use cases, ports and adapters.

Fan out subagents here only when the question is genuinely parallel, for example reading four
candidate siblings at once. Not for one file, and not for anything needing judgement per file.

## 3. Design

Two tracks. Most user-facing work needs both.

**Interface.** Build a design canvas: artboards on one pan-and-zoom surface, published as an
Artifact, so the whole flow is visible and the user can move things instead of describing changes
in prose. A canvas or design skill does that for you where one is available; this repo ships none,
so do not wait for it. Cover the states that get forgotten: empty, loading, error,
permission denied, narrow viewport. Keep the URL; it goes under the project's `## Design` and into
every ticket that touches a screen.

For one component or a diagram, a plain Artifact is lighter than a canvas. Do not reach for a
canvas when an annotated screenshot would do.

**System.** Contracts first. `packages/api` owns the API shapes and both sides import them, so the
contract is the design artefact, not a description of one. Work outward: what the contract says,
what the schema needs, what each side implements against it. Name the migration if the schema
moves.

A short system design goes under the project's `## Design`. A long one is an ADR.

## 4. Record the decision

An ADR under `apps/docs/content/developers/design-decisions/` (there is a template there) is for a
decision that was genuinely contested and that someone will later ask about. Most features need
none; the obvious application of an existing pattern is not an architectural decision, and
recording it as one dilutes the ones that matter.

If the design contradicts an existing ADR, say so rather than overriding it silently.

## 5. Project and tickets

Write the project body in the template shape from `ticket-standard.md`: Problem, Outcome, Non-goals,
Design, Deliverables, Done when, Risks and dependencies. Under 2,500 characters. The one-line
description is the outcome in a sentence. Name a lead and, when the design is settled, a target
date.

When the project already exists, propose edits to its body section by section rather than replacing
it. Move anything that is bookkeeping (inventories, dates the container was made, consolidation
notes) to a comment.

Then the tickets, each in the work item, bug or spike shape, each meeting the ticket gate: type
label, area labels, this project, acceptance criteria, no blockers. Split along user-visible
outcomes, never along layers. "Backend endpoint", "frontend form" and "tests" are not independently
valuable; "org admin can invite a member", "invited member can accept", "org admin can revoke" are.

Every ticket links back: the canvas URL and the ADR path in the ticket, not only in the project,
because the person picking it up reads the ticket and nothing else.

Milestones only where order inside the project genuinely matters. Blocking relations likewise. A
false chain from each ticket to the next makes the board unworkable.

## Before you write it back

Run the prose standard from `ticket-standard.md` on the project body and every ticket: heading set
equals the shape, length within budget, longest bullet under 25 words, zero em dashes, no
authorship banner, at most one "not" clarification. A failed check stops there; fix the body first.
Then the `unslop` skill. Then show the user the project body and the ticket list, and wait. Nothing
is written to Linear that a person has not read.

Never invent acceptance criteria. Where a criterion is inferred from code or a sibling, say so in
the ticket and mark it "confirm". An open question in the body beats a confident guess.

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

What you learn here becomes the project's implementation deep dive, one of the standard resources
in `ticket-standard.md`. Write it against a named commit and say so in its first line, because a
reader a month later needs to know what it was true of. Draw the mechanisms instead of describing
them: a sequence diagram for a request path, a class diagram for what an entity holds, a state
diagram for a lifecycle, a flowchart for the order of work. Mark where each ticket cuts in, so one
document answers both how the area works and what the project changes.

## 3. Design

Two tracks. Most user-facing work needs both.

**Interface.** Sketch the screens that have no design yet, and draw them in the platform's own
design scheme: take the tokens, the type and the component chrome from `apps/web`, so a reader
sees the product and not a generic wireframe. One HTML file holding every screen is enough, and
`pnpm linear:upload` puts it in Linear's asset store so it opens without an account; the
`<Project>: screen sketches` document links it and lists which ticket each screen serves. Cover
the states that get forgotten: empty, loading, error, permission denied, narrow viewport. A
sketch fixes what is on a screen, not its spacing or its copy, so a ticket keeps `needs-design`
until a real design is attached.

For one component or a diagram, a plain diagram in the deep dive is lighter than a set of
screens. Do not sketch a screen when an annotated screenshot would do.

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

Every ticket links back: the sketches, the deep dive and the ADR path in the ticket, not only in
the project, because the person picking it up reads the ticket and nothing else.

Publish the resources with the project: `pnpm linear:document` for the deep dive and the sketches,
`pnpm linear:view` for the shared ticket view and its document, and one more `linear:document` for
the artifact index that links them. `ticket-standard.md` names the set and the two rules a resource
must meet, and the commands are in `tooling/devkit/README.md`.

Milestones only where order inside the project genuinely matters. Blocking relations likewise. A
false chain from each ticket to the next makes the board unworkable.

## Before you write it back

Write the tickets as one draft file in the format `tooling/devkit/README.md` describes, with the
project named in its front matter and `blocks:` only where order genuinely matters. Run
`pnpm linear:check` on it, and on a second draft holding the project body if you are writing or
editing one; the check recognises the project shape by its headings. A failed check stops there;
fix the body first. Then the `unslop` skill. Then show the user the project body and the ticket
list, and wait. Nothing is written to Linear that a person has not read. Once they have read it,
`pnpm linear:create <draft.md> --apply` creates the tickets; the project body itself is a
`projectUpdate` through `linear:query`.

Never invent acceptance criteria. Where a criterion is inferred from code or a sibling, say so in
the ticket and mark it "confirm". An open question in the body beats a confident guess.

Write every ticket and the project body in whole sentences. The budgets in the standard are met by
cutting criteria or moving detail to a comment, never by compressing a bullet into a list of
nouns. A person reads these, and a fragment they have to decode costs more than the characters it
saved.

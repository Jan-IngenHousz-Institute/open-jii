---
name: openjii-work-design
description: Take an idea from a sentence to a designed Project with its tickets in Linear - frame the problem, ground it in the existing codebase, design the solution as a visual canvas or a written system design, record the decision if it is contested, then write the project in the template shape, sequence it in milestones, granularise it into tickets, review it on two plan pages and apply it. Use when conceptualising a feature, designing a solution before implementation, or planning any body of work larger than one ticket.
---

# From idea to a designed project

Read `AGENTS.md` first. The project shape, the ticket shapes, both gates and the prose standard are
in `docs/agents/ticket-standard.md`; read it before writing anything. Writing a single ticket is the
`openjii-ticket-refine` skill. Access, conduct and query recipes are in `openjii-linear`.

The unit of design is a Linear **project**. There are no epics. A project holds the design; its
tickets hold the work.

Seven stages, one outcome each. Skip a stage deliberately, not by drifting past it. Small work
legitimately skips stages 3 and 4.

| Stage                  | Outcome                                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| 1. Frame               | A problem statement: who, what, why, and what is out of scope                  |
| 2. Ground              | The in-repo precedent this will follow, named by file, and the claims checked  |
| 3. Design              | A design canvas, a written system design, or both, and the screens             |
| 4. Record              | An ADR, only when the decision was contested                                   |
| 5. Project and tickets | A project in the template shape, in milestones, with tickets that read cold    |
| 6. Review              | The project plan and the Linear change plan, read and approved by a person     |
| 7. Apply and validate  | Everything written in order, then checked against the code and fixed in Linear |

## 1. Frame

Pin down who this is for, what changes for them, and why it is worth doing now. The persona is a
real one: researcher, org admin, field operator, platform operator. "The user" is not a persona.

State the non-goals. They stop stage 3 from sprawling and they become the project's `## Non-goals`
verbatim.

When the ask is open ("scope out what is needed"), research first. The deliverable is a sourced
assessment with decisions, a timeline and a cost, and it stays local until the person asks for
Linear. Work that answers an outside framework, such as SOC 2, is walked item by item against the
framework, not only against the gaps found first.

Search Linear before going further: projects by name, then `searchIssues` on two or three of the
user's own words. A backlog this old often already holds the idea. If a project exists, this skill
extends it rather than opening a second one. Existing tickets are kept and refined, never
replaced. Read their comments and the project's documents for decisions an earlier session took.

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

Existing tickets and projects in the area, especially AI-triaged ones, are claims. Verify each
against the code and the installed library source, and write down which held, which did not and
what the triage missed. A worktree has no `node_modules`, so read library source from the main
checkout.

Fan out subagents here only when the question is genuinely parallel, for example reading four
candidate siblings at once. Not for one file, and not for anything needing judgement per file. What
a subagent reports is a lead until you have read the line yourself.

What you learn here becomes the project's implementation deep dive, one of the standard resources
in `ticket-standard.md`. Write it against a named commit and say so in its first line, because a
reader a month later needs to know what it was true of. Draw the mechanisms instead of describing
them: a sequence diagram for a request path, a class diagram for what an entity holds, a state
diagram for a lifecycle, a flowchart for the order of work. Mark where each ticket cuts in, so one
document answers both how the area works and what the project changes.

## 3. Design

Two tracks. Most user-facing work needs both.

**Interface.** Draw the screens that have no design yet in the platform's own design scheme, and
capture the real app only where it already shows the thing. `references/screens.md` covers what to
draw, when to scaffold a reference implementation, and what a screen may show. Every ticket that
changes a screen embeds its picture in the body, so the sketches document is the collection and
not the delivery. Cover the states that get forgotten: empty, loading, error, permission denied,
narrow viewport. A sketch fixes what is on a screen, not its spacing or its copy, so a ticket keeps
`needs-design` until a real design is attached.

For one component or a diagram, a plain diagram in the deep dive is lighter than a set of
screens. Do not sketch a screen when an annotated screenshot would do, and do not invent one for
work with no visible surface.

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
Design, Deliverables, Done when, Risks and dependencies. Under 2,500 characters of prose. The
one-line description is the outcome in a sentence. The lead is the person running the session and a
target date is set only if one was given; neither is a question. When the project delivers a list
of things, the body names the categories and a catalogue document names every item.

When the project already exists, propose edits to its body section by section rather than replacing
it. Move anything that is bookkeeping (inventories, dates the container was made, consolidation
notes) to a comment or a document.

Then the milestones, before the tickets. They are a strict sequence by dependency and urgency, each
named as an outcome, numbered, and carrying one sentence on why it comes before the next. No
parallel lanes, no themes. Write them as a file for `pnpm linear:milestones`.

Then the tickets, each in the work item, bug or spike shape, each meeting the ticket gate and each
in exactly one milestone. Split along user-visible outcomes, never along layers. "Backend
endpoint", "frontend form" and "tests" are not independently valuable; "org admin can invite a
member", "invited member can accept", "org admin can revoke" are. The invisible work gets its own
tickets too: deployment, infrastructure, rate limits, spend alerts, kill switches, feature-flag
identity and usage plumbing. Policies, training and vendor reviews are tickets in the same shape.
`ticket-standard.md` says what makes a ticket readable cold: one outcome, a screen in the body, a
first comment that says where to start, and open questions written as questions. A WHO that cannot
name a concrete situation means the split is wrong.

Before a ticket is shown, run a risk pass and bring recommendations, not only questions: related
tickets already in flight, edge write paths such as cascades and autosave, cost, and what the
change means for fields other features share. A ticket owned by someone else gets that owner's side
stated in the review, and the owner is told when a new ticket changes the meaning of theirs.

Every ticket links back: the sketches, the deep dive and the ADR path in the ticket, not only in
the project, because the person picking it up reads the ticket and nothing else.

Publish the resources with the project: `pnpm linear:document` for the deep dive, the sketches and
the catalogue, `pnpm linear:view` for the shared ticket view and its document, and one more
`linear:document` for the artifact index that links them. `ticket-standard.md` names the set and
the two rules a resource must meet, and the commands are in `tooling/devkit/README.md`.

Blocking relations only where order inside a milestone genuinely matters. The order of work is the
milestones; a chain of blockers from each ticket to the next makes the board unworkable.

## 6. Review

Write the tickets as one draft file in the format `tooling/devkit/README.md` describes, with the
project named in its front matter, `milestone:` on each ticket and `blocks:` only where order
genuinely matters. Run `pnpm linear:check` on it, and on a second draft holding the project body if
you are writing or editing one; the check recognises the project shape by its headings. A failed
check stops there; fix the body first. Then the `unslop` skill.

Then build the two plan pages from those drafts: the project plan and the Linear change plan.
`references/review-pages.md` says what each holds and how they are laid out. Do not type them by
hand and do not ask for the apply until both exist.

Run the verification pass from `ticket-standard.md` on everything the pages show: every path and
line number against the commit named, budgets, the milestone diagram against the drafts' relations,
spelling against the product locale, and the same milestone names in every document. Fix what it
finds and republish the pages in place.

For a rewrite of many tickets, show three first and wait for a yes on voice and images. Then show
the rest. Nothing is written to Linear that a person has not read, and a short "proceed" approves
the recommended options on the change plan and nothing else. List the open decisions once, each
with a default, and keep unanswered ones in their tickets.

Never invent acceptance criteria. Where a criterion is inferred from code or a sibling, say so in
the ticket as an open question under Dependencies and risks. An open question beats a confident
guess.

Write every ticket and the project body in whole sentences. The budgets in the standard are met by
cutting criteria or moving detail to a comment, never by compressing a bullet into a list of
nouns. A person reads these, and a fragment they have to decode costs more than the characters it
saved.

## 7. Apply and validate

Apply in this order, each step a dry run first and `--apply` once the person has read it:

1. `pnpm linear:milestones <file>`, so the names exist before a ticket names one.
2. `pnpm linear:create <draft>`, which creates the tickets in their milestones, rewrites `{{N}}`
   references, posts the first comments and sets the relations. A rewrite of existing tickets adds
   `--sync-labels` when the draft's labels are the full set.
3. The project body, as a `projectUpdate` through `linear:query`.
4. The resource documents, then the artifact index.
5. The two plan pages, republished with real ids, then uploaded once and linked from the index.

Ids do not exist before step 2, so documents and sketches carry placeholders first and are
published again once the ids exist. That is two publishes by design, and the upload waits for the
second one because an upload cannot be deleted.

Update the change plan's write log as each step finishes, from planned to done.

Then validate the design against the code. Read the system design as the code stands, find what a
ticket promises that the code cannot deliver, and change Linear where it is wrong instead of only
reporting it. Read back what was written, re-check the milestone order, and report what was
verified.

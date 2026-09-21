---
name: openjii-ticket-refine
description: Write one OJD ticket in the agreed shape, or bring an existing one up to the ticket gate - structure, acceptance criteria, labels, project, and splitting work that is too big. Use when a single ticket needs writing, when a ticket is too vague to start, or during the Monday review of what is in Ready.
---

# Refining a ticket

Read `AGENTS.md` first. The ticket shapes, the ticket gate and the prose standard are in
`docs/agents/ticket-standard.md`; read it before writing, do not reconstruct the headings from
memory. Access and query recipes are in `openjii-linear`.

This skill produces one ticket someone could pick up without asking a follow-up question. That is
the whole bar.

It assumes the solution is already designed. Work that needs designing first, or that is larger
than one ticket, starts in `openjii-work-design`, which writes the project and comes back here for
the tickets.

## The one rule

**Never invent acceptance criteria.** They are a contract about what will be built and tested. A
plausible criterion nobody agreed to is worse than an empty section, because the empty section is
honestly unfinished while the invented one silently becomes the spec.

Where you do not know, ask. Where you infer from code or a sibling feature, say so in the ticket:
"inferred from `experiment-overview`, confirm". Three confirmed criteria and an open question beat
eight confident guesses.

The same goes for the rest: do not guess the persona, do not assert a benefit nobody stated, do not
pick a project because the name sounds close.

## Working a new ticket

Fill the gaps in this order. Stop and ask as soon as an answer would change the ticket rather than
decorate it.

1. **Shape.** Work item, bug or spike. If the output is an answer rather than a change, it is a spike
   with a timebox. If it needs more than one person or more than one change cycle, it is a project,
   and the real work is `openjii-work-design`.
2. **Project.** Required. Find the existing project this belongs to. If none fits and the work is
   solution-shaped, that is a missing project, not a reason to use the maintenance bucket.
3. **WHO, WHAT, WHY.** A real persona: researcher, org admin, field operator, platform operator.
4. **Acceptance criteria.** The primary flow, the alternative flows that matter, and the business
   rules that apply. Name what must be shown on screen. Observable behaviour only; implementation
   suggestions go under Additional context.
5. **Dependencies and risks.**
6. **Labels.** One `type`, at least one `area`. Both are required by the gate.
7. Leave `## How it was built` and `## Testing criteria` empty. The developer fills them through
   `openjii-testing-criteria` before review.

Write it as a draft file in the format `tooling/devkit/README.md` describes; `.claude/tickets/` is
gitignored and a good home. That is what `pnpm linear:check` reads and `pnpm linear:create` creates
from. Implementation pointers that do not fit the budget go after the `<!-- comment -->` marker,
which becomes a comment on the created ticket.

Search before creating: `searchIssues` on two or three of the user's own words. If a close match
exists, say so and offer to refine that one instead. Existing tickets are not precedents for shape
or wording; most predate this standard. The shape comes from `ticket-standard.md` and nowhere else.

## Bringing an existing ticket up to the gate

Read the ticket **and its comments**. Comments routinely hold the decision the description never got
updated with; rewriting over the top of that loses it.

Preserve what is there. Refining means restructuring and filling gaps, not replacing someone's
words with your own phrasing of the same thing.

Then check the gate: one `type` label, at least one `area` label, a project, non-empty acceptance
criteria (or `Done when` for a spike), no unresolved blocking relation. The judged half (INVEST, the
acceptance-criteria bar, designs attached for frontend work) is in the Team Process document in
Linear; fetch it, do not restate it.

Report what fails. Labels and project you can propose and apply. Missing acceptance criteria is a
conversation, not a fix.

## When it is too big

"Small" means one person can carry it to `Ready For Prod` without splitting. When a ticket fails
that, split it. Do not estimate it; the team runs no estimation and no cycles.

Split along user-visible outcomes, never along layers. The pieces stay under the same project;
there is no epic to create. Blocking relations only where order genuinely matters.

## Before you write it back

- `pnpm linear:check <draft.md>`. A failed check stops there; fix the body before going on. Do not
  reconstruct the check by hand.
- Then the `unslop` skill.
- Set the state deliberately: a ticket that passes the gate goes to `Ready`; one still carrying open
  questions stays in `Backlog` with `needs-info`.
- Show the user the body before creating or updating, and wait. Nothing is written to Linear that a
  person has not read.
- Then `pnpm linear:create <draft.md>` for the dry run, and `--apply` once they have read it. It
  refuses a failing draft, resolves the project and labels by name, rewrites `{{N}}` references to
  real identifiers, posts each comment block, sets `blocks:` relations, and resumes from its state
  file if interrupted. Updating an existing ticket is still `issueUpdate` through `linear:query`.

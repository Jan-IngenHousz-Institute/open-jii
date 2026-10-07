---
name: openjii-ticket-refine
description: Write one OJD ticket in the agreed shape, or bring an existing one up to the ticket gate - structure, acceptance criteria, labels, project, and splitting work that is too big. Use when a single ticket needs writing, when a ticket is too vague to start, or during the Monday review of what is in Ready.
---

# Refining a ticket

Read `AGENTS.md` first. The ticket shapes, the ticket gate and the prose standard are in
`docs/agents/ticket-standard.md`; read it before writing, do not reconstruct the headings from
memory. Access and query recipes are in `openjii-linear`.

This skill produces one ticket someone could pick up without asking a follow-up question. That is
the whole bar. The reader is a developer new to the area, or a delegate, who has the ticket and
nothing else, so readability comes before completeness. `docs/agents/ticket-standard.md` sets out
what reading cold needs under "A ticket is read cold".

It assumes the solution is already designed. Work that needs designing first, or that is larger
than one ticket, starts in `openjii-work-design`, which writes the project and comes back here for
the tickets.

## The one rule

**Never invent acceptance criteria.** They are a contract about what will be built and tested. A
plausible criterion nobody agreed to is worse than an empty section, because the empty section is
honestly unfinished while the invented one silently becomes the spec.

Where you do not know, ask. Where you infer from code or a sibling feature, say so in the ticket as
an open question under Dependencies and risks: "Open: does this follow `experiment-overview` for
archived rows? Ask the TPM." A criterion states a rule, so it never carries the question. Three
confirmed criteria and an open question beat eight confident guesses.

The same goes for the rest: do not guess the persona, do not assert a benefit nobody stated, do not
pick a project because the name sounds close.

## The other rule

**Write in proper English.** Every bullet is a whole sentence with a subject and a verb, and so are
the WHO, WHAT and WHY lines. "Sortable: name, status, updated. Confirm" is a list of words; "Name,
status and updated date are sortable. Confirm this set." is a sentence. When the body runs over
budget, remove a criterion. Never save characters by dropping the grammar; a person reads this,
and a ticket that cannot be read is not shorter, it is unfinished.

## Working a new ticket

Fill the gaps in this order. Stop and ask as soon as an answer would change the ticket rather than
decorate it.

1. **Shape.** Work item, bug or spike. If the output is an answer rather than a change, it is a spike
   with a timebox. If it needs more than one person or more than one change cycle, it is a project,
   and the real work is `openjii-work-design`.
2. **Project.** Required. Find the existing project this belongs to. If none fits and the work is
   solution-shaped, that is a missing project, not a reason to use the maintenance bucket. Read
   that project's documents before writing: the deep dive says how the area works today, and the
   sketches say what the screen should show. Link them from the ticket when it touches a screen.
3. **WHO, WHAT, WHY.** A real persona: researcher, org admin, field operator, platform operator.
4. **Acceptance criteria.** The primary flow, the alternative flows that matter, and the business
   rules that apply. Name what must be shown on screen. Observable behaviour only; implementation
   suggestions go under Additional context.
5. **Dependencies and risks.** It opens with a line naming each blocker by identifier and what it
   delivers, so a reader sees the order without opening the relations. Then every open question,
   written as a question with the default the ticket proceeds on. A ticket that cannot start
   without an answer is not `Ready`.
6. **The screen.** A ticket that changes a screen embeds its picture under Additional context, with
   a caption that describes the picture. It is a capture of the real app with the change
   scaffolded in, made as `openjii-work-design`, `references/screens.md` describes. A ticket with
   no visible surface gets none.
7. **Labels.** One `type`, at least one `area`. Both are required by the gate, and both must be
   labels that exist today (`linear-taxonomy.md`, "Labels today").
8. Leave `## How it was built` and `## Testing criteria` empty. The developer fills them through
   `openjii-testing-criteria` before review.
9. **The first comment.** After the `<!-- comment -->` marker, open with a sentence on what the
   comment holds and which milestone the ticket sits in. Then name the files in full repository
   paths with line numbers, checked against a named commit on `main` as you write them and linked
   as permalinks pinned to it, and give the local steps to test the change. Anything the body had
   no room for goes here and is never dropped.
10. **Links.** The sources behind the ticket's claims, such as the official documentation for the
    fix and related Linear documents, go in the draft as `link:` lines and land as the ticket's
    links.

If you cannot give the ticket a concrete WHO, a situation a person is actually in, the ticket is
split along a mechanism and not an outcome. Split it again instead of rewording it.

Before the ticket is shown, run a risk pass and bring a recommendation for each finding, not only
a question: related tickets already in flight, edge write paths such as cascades and autosave,
cost, and what the change means for fields other features share.

Write it as a draft file in the format `tooling/devkit/README.md` describes; `.claude/tickets/` is
gitignored and a good home. That is what `pnpm linear:check` reads and `pnpm linear:create` creates
from. Examples are generic, such as a drought trial or a sensor fleet, never a study name or an
instrument term, and name other tickets by identifier. The first comment goes after the
`<!-- comment -->` marker.

Search before creating: `searchIssues` on two or three of the user's own words. If a close match
exists, say so and offer to refine that one instead. Existing tickets are not precedents for shape
or wording; most predate this standard. The shape comes from `ticket-standard.md` and nowhere else.

## Bringing an existing ticket up to the gate

Read the ticket **and its comments**. Comments routinely hold the decision the description never got
updated with; rewriting over the top of that loses it.

Preserve the substance. Every criterion, every decision and every open question stays. Refining
means restructuring and filling gaps; reword only where the sentence cannot be read cold, and list
each rewording as a decision the person can veto. Narrowing a ticket needs the same care: read its
comments and the project's documents first, because an earlier session may have settled the point
you are about to reverse. Existing tickets are kept and refined, never replaced.

Then check the gate: one `type` label, at least one `area` label, a project, non-empty acceptance
criteria (or `Done when` for a spike), no unresolved blocking relation. The judged half (INVEST, the
acceptance-criteria bar, designs attached for frontend work) is in the Team Process document in
Linear; fetch it, do not restate it.

Report what fails. Labels and project you can propose and apply. Missing acceptance criteria is a
conversation, not a fix. A ticket that passes except for a blocker stays in `Backlog` with the
relation set. A `Ready` ticket carrying an open question that changes what is built goes back to
`Backlog`, or you propose an answer in the draft and list it as a numbered decision the person can
veto. Priority is the TPM's, so report the `Ready` tickets that have none and leave them.

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
  questions stays in `Backlog`. The `needs-info` label does not exist yet, so say it in a comment.
- Show the user the body before creating or updating, and wait. Nothing is written to Linear that a
  person has not read.
- Then `pnpm linear:create <draft.md>` for the dry run, and `--apply` once they have read it. It
  refuses a failing draft, resolves the project and labels by name, rewrites `{{N}}` references to
  real identifiers, posts each comment block, sets relations, and resumes from its state file if
  interrupted. A draft headed by an identifier updates that ticket through the same command, and
  edits its pointer comment in place when the first line matches.

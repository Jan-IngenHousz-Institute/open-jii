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
sub-types beyond the three shapes below do not matter. Milestones sequence the work inside a
project and are required once it has more than one ticket; they are not a second project layer.

Every ticket belongs to exactly one project. `openJII Development` is the maintenance bucket for
bugs and chores with no solution home, and its scope line says so. A solution-shaped ticket that
fits no project is a signal that the project is missing, not that the bucket is right.

## Project shape

One template, fixed headings, under 2,500 characters of prose. The one-line `description` field is
the outcome in a sentence. The lead and team `OJD` are set when the project reaches `Planned`. The
lead defaults to the person running the session and is never asked about. A target date is set
only when someone supplies one. Priority is the TPM's call, so an agent leaves it unset.

```markdown
## Problem

Who has it, what happens today, why it matters now.

## Outcome

What is true when this is done. One paragraph.

## Non-goals

What this deliberately does not cover.

## Design

The project's resources, linked: the deep dive, the sketches or design canvas, the ADR, and the
contract changes in `packages/api`. A short system design or a pointer. The precedent in the
codebase this follows.

## Deliverables

The milestones in order of work, one line each. The tickets sit under their milestone in Linear.

## Done when

Observable checks, and who accepts: the person who requested it, or the technical approver named
in the Team Process document.

## Risks and dependencies
```

Nothing in the body about which agent created it, when the container was made, or which issues
were inventoried. That is bookkeeping, and it goes in one of the project's documents or nowhere.
Never in a project update: Linear's project updates are the status post the team reads in its
feed, so an inventory posted there reaches nine people as news.

### Project resources

A project carries its design and its grounding as Linear documents on the project itself, so a
reader who opens the project finds them without being sent elsewhere. Four are the standard set.
A project that delivers a list of things, such as every notification type or every starter macro,
adds a fifth: a catalogue that names each item, since the 2,500 character body can only name the
categories. A project carries more when the work needs it. Each is titled `<Project>: <thing>`,
which is how the index links them without knowing their ids.

| Document                   | What it holds                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `implementation deep dive` | How the area works today, against a named commit, with mermaid diagrams, and where each ticket cuts in |
| `screen sketches`          | Every ticket's screens, captured from a scaffold of the change or drawn, on one uploaded page          |
| `live ticket view`         | A pointer to the project's shared ticket view                                                          |
| `artifact index`           | A short front page linking the documents above, the project, and the two plan pages                    |
| `catalogue`                | When the project delivers a list: every item, one line each                                            |

Two rules decide whether something belongs here. A resource complements the project and its
tickets, so a page that restates the deliverables or copies the ticket list is not one; the reader
has both already. The two plan pages below are the one exception, because they record what was
decided and what was written. And a sketch takes its tokens, type and components from `apps/web`,
so a reader sees the product rather than a generic wireframe.

`pnpm linear:document` publishes one and refuses to write until the prose rules pass and every
mermaid block parses. `pnpm linear:resources` adds outside links, such as the uploaded plan pages
and the official documentation the design relies on, to the project's Resources.
`pnpm linear:upload` puts a file in Linear's asset store, where anyone signed in to the workspace
can open it; a request without a Linear session gets a 401, so an upload is not a public link.
`pnpm linear:view` creates the shared view and its document. The formats are in
`tooling/devkit/README.md`.

### The two plan pages

Every project ships with two standalone pages. They are built from the draft files, never typed
by hand, so a diagram of the order of work cannot lose a relation the drafts hold. They are working
documents first and the record afterwards.

| Page                 | What it holds                                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project plan`       | Why, the findings, the design, the integrations, the decisions taken, the milestones and the deep dive                                                                                                               |
| `Linear change plan` | Every write in order with its status, each ticket as it will appear with its screen, a before and after for every rewrite, the disposition of every existing ticket, relations added and removed, what is left alone |

The two pages link to each other and are republished in place at every step. Both exist before
anyone asks for the apply. The change plan is how a person reads the
tickets: nothing is written to Linear that they have not seen on it, and a short "proceed" approves
the recommended options on that page and nothing else.

Ticket ids do not exist until the apply, so the pages carry placeholders first and are published
again once the ids exist. Only then is one copy of each uploaded with `pnpm linear:upload --apply`,
linked from the artifact index and added to the project's Resources. An upload cannot be deleted, so
a correction after that is a new upload and a new link, and the old copy stays reachable. The layout
is in `.agents/skills/openjii-work-design/references/review-pages.md`.

### Dispositions

Every existing ticket a project touches is kept, changed or dropped, with a reason, and the change
plan lists all of them. Existing tickets are refined, never replaced. A dropped ticket is canceled
with a one-line reason, or closed as a duplicate with the relation. The draft is checked against
the list before the apply, because writing the dispositions down is what surfaces a requirement
that was silently dropped.

### Milestones

Milestones are the order of work, and a reader who has never opened the project must be able to
see that order.

- The milestones are a strict sequence. There are no parallel lanes, no "can run alongside", and no
  themes. Sequence them by dependency and urgency.
- A milestone is named as an outcome and numbered in its name, as in
  `1. Members see what happened to their work`.
- Its description is one sentence saying why it comes before the next.
- Every ticket sits in exactly one milestone.
- The sort order is spaced by 1,000, because Linear has been seen rewriting positions that were too
  close together. `linear:milestones` reads the order back to catch it.
- An old milestone is renamed, never deleted, so its history stays.
- The names are identical in every document, ticket and plan page that mentions them.

`pnpm linear:milestones` creates, renames and orders them from a file, and checks the rules above
before it writes anything.

### Project lifecycle

| Status        | Meaning                                     | Leaves it when                                                           |
| ------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| `Backlog`     | An idea with the template started           | it passes the project gate                                               |
| `Planned`     | Designed and granularised                   | the first ticket starts                                                  |
| `In Progress` | Work under way                              | every ticket is `Done` and "Done when" is verified by the named acceptor |
| `Completed`   | Live and accepted                           | terminal                                                                 |
| `Canceled`    | Dropped, with a one-line reason in the body | terminal                                                                 |

**Project gate** (`Backlog` to `Planned`), checkable by a script: every heading above present and
non-empty, a lead, milestones once there is more than one ticket, at least one ticket in `Ready`,
and a resource linked under `## Design`. That resource is a design canvas or the sketches when the
work is user-facing, and the deep dive otherwise.

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

The screen of the change, links, design canvas, the precedent this follows, suggested
implementation.

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

## A ticket is read cold

The test is not whether a ticket is valid. It is whether a developer new to the area, or a
delegate, can start it without asking anybody. Readability comes before completeness.

**One outcome per ticket.** The board is where people choose what to pick up, so a ticket bundling
several outcomes is too big even when each is one sentence. A ticket looks the way a developer
expects a ticket to look; a dense specification inherited from triage is recut into ordinary
tickets. A vague WHO is the tell: if no concrete situation can be named ("a researcher looking at a
checklist step"), the split follows a mechanism rather than an outcome, so split again instead of
rewording.

**The invisible work is on the board.** Enabling and operational work gets its own tickets:
deployment and infrastructure, secrets, scheduled jobs, monitoring and alerts, data retention, an
outbox for anything sent, rate limits, spend alerts, kill switches, feature-flag identity, usage
plumbing, and what the provider account actually allows, such as an email service's sending quota.
Walk this list as a standard pass on every project. Splitting along user-visible outcomes never
means dropping them. Work that is not code, such as policies, training and vendor reviews, takes the
same team, shape and gates as code work.

**Examples are generic.** A drought trial and a sensor fleet, not a study name, an instrument
jargon term, a column name or a team name. This repository is public.

**A screen sits in the body.** A ticket that changes a screen embeds a picture of the change under
`## Additional context`, or under `## Evidence` for a bug. A linked document, a downloadable
sketch and a review page do not count, because the body is what the delegate reads. The picture is
a capture of the real app with the change scaffolded into it, as `openjii-work-design` describes,
and a drawing only where the app cannot show it. The caption
describes the picture, not the ticket, and starts with `Sketch:` when it is a drawing. A spike has
no Additional context, so its screen goes in its comment. Work with no visible surface, such as a
rate limit or a durable write, gets no screen, and a decorative one is worse than none.

**Tickets are named by identifier.** "The previous ticket" and "the configuration ticket" break the
moment the board is sorted differently. Use `OJD-1234`, or `{{N}}` in a draft.

**The first comment says where to start.** It opens with a sentence on what it holds and which
milestone the ticket sits in, then names the files in full repository paths with line numbers,
checked against a named commit on `main` and linked as GitHub permalinks pinned to that commit. It
adds the local setup for testing the change and the sources behind any claim: code pinned to a
commit and the official documentation for the fix. Comments carry no budget, so anything cut from a
body to fit goes here and is never dropped. Every pointer is checked again when it is written, and a
comment that already exists is edited in place rather than a second one stacked beside it.

**Sources live in Linear.** A claim in a ticket or a document comes with a link a reader can open:
code pinned to a commit, the official documentation for the fix, and related Linear documents. A
ticket carries them as links, written as `link:` lines in its draft, or in its first comment. A
project carries its outside references as resources, and each document section ends with its
sources. A local draft or a chat message is not a source anyone else can open.

**Order is visible without opening anything.** A blocked ticket's `## Dependencies and risks` opens
with a line naming each blocker by identifier and what it delivers, such as "Blocked by OJD-1234,
which adds the export endpoint." The relation is set in Linear as well; the line is for the reader.

**Open questions are written as questions.** They live under `## Dependencies and risks` as
"Open: does this apply to archived experiments? Ask the TPM." Acceptance criteria state rules, so
a criterion never ends in a question mark or says "confirm". A `Ready` ticket carries no open
question that changes what is built; one that does not change the work stays, with the default the
ticket proceeds on.

**Nothing is cut to fit a tool.** A budget exists so a ticket stays readable. Screens, link targets
and URLs are not prose and do not count, and `linear:check` leaves them out. When a body is still
over, a criterion moves to a comment or the ticket splits; the grammar is never compressed.

**Security work describes the fix only.** Every `OJD` ticket and comment mirrors to public GitHub.
A ticket says what to build or change. What is weak today lives in a project document.

## Put it in context

An agent writing a ticket has the code it read, the session and the other tickets it drafted in its
head. A developer opening the ticket has none of that. Everything written into Linear, whether a
ticket body, a comment, a project body, a document or a plan page, puts its subject in context for
that reader, and the screen in the body is part of how it does so. Grammar is the floor, set by the
prose standard below. These rules are about meaning, and they outrank completeness.

**Say where it happens.** Name the page and how a user gets there, and who is on it. In a work item
the WHO line carries it, as in "**WHO:** A researcher on an experiment's Data tab, reached from
Experiments, comparing treatments." In a bug it is the first reproduction step. The screen shows
that place, and the text tells the reader what to look at in it, such as "the outlined column". A
screen with no words around it and words with no screen both leave the reader guessing.

**Start with the situation.** The first lines a reader meets say what a user sees or does there
today and what is wrong or missing, before any design or code. A ticket that opens with a mechanism
("Add a `latestPer` param to the read path") makes the reader reconstruct why it exists.

**Say how it fits.** The first comment opens with the ticket's place in the project: its
milestone, what it builds on and what waits for it. A developer who picks one ticket off the board
still knows what the larger piece of work is.

**Plain words.** A term a newcomer to the area would not know, such as an internal name, a
component, a table, an acronym or a mechanism, is replaced by what it does, or explained in the same
sentence the first time it appears. Code names belong in the first comment, where the reader goes
to find the code, and never in the acceptance criteria.

**No borrowed context.** Nothing points at a conversation the reader was not in: no "as discussed",
"as agreed", "per the review", "in the earlier session", "option B" or "the new flow". Say the thing
itself. `linear:check` fails the common phrasings.

**One name per thing.** A feature, a screen or a role has one name across the ticket, its comment,
the project and every document. A reader who meets "the panel", "the drawer" and "the sidebar" sees
three things.

**Every reference resolves.** Tickets by identifier, files by full repository path, documents by
link, people by role. A reader can follow each one without asking where it is.

**Questions carry their context.** An open question says what it is about, what each answer would
change, and the default the work proceeds on, so someone who missed the discussion can answer it.
"Confirm retention and org-wide sharing" got "what do you mean?"; "Open: should a deleted member's
notifications be kept for the 90 days the rest of their data is? Keeping them is the default. Ask
the TPM." can be answered.

**Concrete before abstract.** A generic example ("a drought trial with three treatments, where the
researcher filters to drought") shows a rule faster than the rule stated alone.

### The cold-reader test

Before anything is shown to the person, give each ticket body with its first comment and screen,
the project body and each document to a reader with none of the session's context, such as a fresh
subagent given only that text and image. Ask it four things: where in the product this happens,
what will be built and for whom, what it leaves out, and which words or references it had to guess
at. Rewrite until its answers match what was meant and the
list of guesses is empty. Then the person reads the result, and for a batch they read three tickets
first.

After the write, read every ticket again as it appears in Linear, top to bottom, the way a developer
choosing work from the board would. Each one says where to start, keeps its open questions in one
place, and can be acted on without the chat. Fix what fails in place.

## Ticket gate

A ticket may leave `Backlog` for `Ready` only when all of these hold. Skills check them; a sweep
reports any `Ready` ticket that fails.

- one `type` label
- at least one `area` label
- a project
- a non-empty `## Acceptance criteria` (or `## Done when`, for a spike)
- no unresolved blocking relation, read from both `relations` and `inverseRelations`
- no open question that changes what is built

Until the label taxonomy is applied, `type` and `area` mean the labels that exist today, listed in
`linear-taxonomy.md` under "Labels today". Priority is set by the TPM when a ticket is moved to
`Ready`; an agent never sets it, and says in its review how many tickets in the batch have none.
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
accepted when the artefact named in its `## Done when` exists, so `Done` means accepted rather than
deployed.

A work item whose output is not code, such as a policy, a training session or a vendor review, has
no PR and nothing to deploy. Its acceptance criteria name the artefact that ends it, it leaves the
two developer sections empty and skips `In Review` and `In Testing`, and the person who requested it
moves it to `Done` once the artefact exists.

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
| `Backlog`        | Not ready: unrefined, or refined but blocked       | it passes the ticket gate                                       |
| `Ready`          | Someone can pick it up without hunting for context | someone starts it                                               |
| `In Progress`    | Started                                            | the PR is ready for review, with both dev sections filled       |
| `In Review`      | PR open                                            | review is approved and the PR merges                            |
| `In Testing`     | Merged and live on dev                             | QA runs the testing criteria and signs off                      |
| `Ready For Prod` | Tested and signed off, waiting for a release       | the release ships and a person moves it to `Done`               |
| `Done`           | Live on production. Frozen                         | terminal; anything after is a new ticket                        |
| `Canceled`       | Dropped                                            | terminal                                                        |
| `Duplicate`      | Superseded                                         | terminal, and needs the duplicate relation, not just the status |

PR automation, once configured on the team, moves a ticket to `In Progress` when a branch or PR
opens, to `In Review` when the PR is marked ready, and to `In Testing` on merge. Nothing moves a
ticket to `Done` on its own. The production release workflow's `linear-release-action` attaches
every ticket its PRs mention to a Linear release and completes that release, but it never changes a
ticket's state, so a person moves shipped tickets from `Ready For Prod` to `Done` after the release,
as the Team Process document says. To tell whether a change is live, check that its merge commit is
an ancestor of the latest `release/` branch; the `web-v*` and `backend-v*` tags are cut on `main`
and say nothing about production. The UX check stays label-driven
(`needs-ux-check`, `ux-fix-needed`); there is no `In Design Check` state.

A refined ticket that is blocked stays in `Backlog` with the blocking relation set, and moves to
`Ready` when the blocker is done. A person who says "put in Ready what you think is ready" has
delegated the gate call; the agent moves what passes the gate and reports what it moved and why.

Before any state change, read the ticket's `parent`, `children`, `relations` and
`inverseRelations`, and never say "no link" after reading only one of them. Linear cancels the
open sub-issues of a canceled parent, and one of them may be someone else's work. When an umbrella
ticket is split, its blocking relations move to the pieces or are dropped, so the umbrella stops
blocking work it no longer owns. Before narrowing a ticket, read its comments and its project's
documents for decisions an earlier session took.

## Prose standard

The last step of every skill that writes to Linear. These rules come from the failure modes in this
workspace's own agent-written tickets, not from a generic style guide.

The first rule outranks the rest. A ticket is read by a person who did not write it, and it is
written in proper English, on top of putting its subject in context as "Put it in context" says:
whole sentences with a subject and a verb, in every bullet, in the WHO, WHAT and WHY lines, and in
every open question. A budget is met by cutting criteria, never by compressing grammar. "Facets:
status, visibility; protocols family, visibility" is a list of words, and a list of words is not a
ticket.

1. Full sentences everywhere. A bullet reads as one sentence and ends with a full stop. No
   telegraphic fragments, no noun lists, no semicolon chains standing in for sentences.
2. Headings are exactly the shape's. No extra sections, no date-stamped headings.
3. Budgets, counting prose only, so the two dev-filled sections, embedded screens, link targets and
   URLs are excluded: work item under 1,500 characters, bug under 800, spike under 600, project
   body under 2,500. Over budget means a split, or the detail goes to a comment, a linked
   document, or nowhere. It never means shorter grammar.
4. One idea per bullet, under 25 words. A bullet that needs a second sentence is two bullets.
5. Persona first, in WHO, and again in acceptance criteria where it matters: "an org admin can",
   "a plain member sees".
6. Open questions are expected. "Open: does this apply to archived experiments? Ask the TPM." beats
   resolving it by assertion.
7. No investigation narrative. What was checked or corrected on a date is a comment. The body says
   what is true now and what should be built.
8. No orders about what not to build. Say what to build; name the precedent under Additional
   context or Design.
9. Implementation detail is a suggestion and lives under Additional context or Design as
   "Suggested:". Never in acceptance criteria, which describe observable behaviour only.
10. No bookkeeping in the body: no "canonical owner of", "absorbs", "initial issue inventory",
    "project container (date)". Relations are set in Linear, with one line in a comment if needed.
11. No authorship banner. If a person has not read and edited the text, it is not ready.
12. At most one "X, not Y" sentence per body.
13. Titles say what the user can do or what is broken, at most 69 characters, no type prefix
    (`DISCOVERY:` is a label, not a title), no list of three. Project names are the outcome in
    three to six words.
14. Every file named in a ticket, a comment or a document is a full repository path, never a bare
    file name.
15. Spelling follows the product. Ticket and sketch copy uses the spelling of the `en-US` locale in
    `packages/i18n/locales/en-US`, which is American, so grep it when a word is in doubt.
16. Then the `unslop` skill.

A document holds diagrams as well as prose, and a mermaid block Linear cannot parse renders as a
red error box where the picture should be. `pnpm linear:document` parses every block with mermaid
itself before it writes, so a diagram is never published broken.

`pnpm linear:check <draft.md>` runs the mechanical half before a body is shown: every bullet and
every WHO, WHAT and WHY line ends as a sentence and no bullet is a semicolon chain; heading set
equals the shape; length within budget; longest bullet under 25 words; zero em dashes; no banner;
at most one "X, not Y" sentence; title length and prefix; the gate sections non-empty. It cannot
judge grammar, so a fragment that happens to end in a full stop still needs a reader. The draft
format is in `tooling/devkit/README.md`. A failed check stops the write; fix the body first. Then
`unslop`, then the cold-reader test, then the person reads it. Nothing is written to Linear that a
person has not read.

The check also fails an open question or a "confirm" inside the acceptance criteria, a ticket named
by position ("the previous ticket"), and a phrase that points at a conversation the reader was not
in ("as discussed", "we agreed"). It adds a note, which never fails a draft, when a
`Web`, `Mobile` or `Fullstack` ticket embeds no screen. It reads a bullet wrapped over several lines
as one bullet.

Linear rewrites stored markdown: `-` bullets come back as `*`, link targets gain angle brackets,
and a bare domain such as `INFO.nl` becomes a link. A live body can therefore differ from its
draft, so compare after normalising those, and keep link targets out of the prose they sit in.

Before the apply, one more pass that a script cannot do: every path and line number opens at the
commit named, every screen shows only what its criteria say and its caption matches the picture, a
diagram's relations match the draft's `blocks:` lines one for one, spelling matches the product,
and milestone names are identical in every document.
A claim of absence ("there is no dark mode") is checked as hard as a claim of presence, and what
an inventory agent reported is a lead, not a fact, until it is read at line level.

## Relation to the GitHub templates

GitHub Issues is a synced mirror fed from Linear, so `.github/ISSUE_TEMPLATE/` only serves people
filing directly on GitHub, mostly external contributors. Those templates stay and their headings
match the shapes above, so a synced issue parses the same on both sides.

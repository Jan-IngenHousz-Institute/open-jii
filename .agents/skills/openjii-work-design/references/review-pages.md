# The two plan pages

Every project ships with a project plan and a Linear change plan. `docs/agents/ticket-standard.md`
says what each must hold and when it may be uploaded. This file says how they are built and laid
out.

## Building them

Each is one standalone HTML page, generated from the draft files by a script and never typed by
hand, so the page cannot disagree with what will be written. Generate them from the same inputs the
apply reads: the ticket draft, the milestone file, the project body draft and the document drafts.
Draw the order-of-work diagram from the drafts' relations too, never by hand.

The approved layout is the Notifications project's review page, linked from that project's artifact
index in Linear. Read it, and any other example the person names, in full before building a page.
An example read halfway gets imitated halfway, and the page is built twice.

The first publish is private and carries placeholders where ids are not known yet. After the apply,
fill the real ids and links, mark the page as written, and build a standalone copy with the images
inlined and the diagrams rendered to SVG. Upload that copy once with `pnpm linear:upload --apply`,
link the printed URL from the artifact index and the project's `## Design` section, and add it to
the project's Resources with `pnpm linear:resources`.

Take the colours, type and spacing from `apps/web/app/globals.css`, so the page reads as the
product, and make it work in light and dark and at phone width. Captures go on the page as the same
PNGs the tickets carry. A drawn sketch goes on as inline HTML, which follows the theme, while its
ticket gets the rendered PNG.

## Layout

Both pages share the chrome: a sticky navigation, and a hero with the title, status pills and
counts. The pills include whether anything has been written to Linear yet.

**Project plan.** Why, the findings (which claims held and which did not), the design with its
diagrams, the integrations, the decisions taken, the milestones and a link to the deep dive.

**Linear change plan.**

1. A dependency diagram of the milestones, which is the order of work.
2. One section per milestone, in order, never a flat ticket list.
3. For each ticket: its labels, its blocker line, its full body as it will appear, its first
   comment in a fold, and its screens beside it.
4. For each rewrite, the live body and the new one, side by side, after normalising Linear's
   markdown rewrites.
5. The disposition of every existing ticket: kept, changed or dropped, each with a reason.
6. Relations added and removed, and what is left alone.
7. The open decisions, numbered, each with an owner and a default, so the person can veto by
   number.
8. The apply sequence as numbered steps, each with a status that changes from planned to done as
   the sweep runs.
9. Folds for the project body with its character count, and for findings that fit nowhere else.

Name tickets by identifier everywhere, and use the same milestone names as the documents and the
tickets. Note in the plan which things `linear:create` cannot change on an update, such as a
priority, so the person is not surprised.

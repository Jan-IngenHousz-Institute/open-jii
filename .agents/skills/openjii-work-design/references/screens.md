# Screens for tickets

A screen is part of the spec, so it shows what the acceptance criteria say and nothing more. The
placement and caption rules are in `docs/agents/ticket-standard.md` under "A ticket is read cold".

## What to draw and what to capture

Draw a sketch in the platform's tokens for any screen that has no design yet. Take the tokens,
type and component chrome from `apps/web`, starting at `apps/web/app/globals.css`, so a reader sees
the product and not a wireframe. Inline HTML follows the theme on a page, but Linear needs a PNG,
so render one for the ticket.

Capture the real app only where it already shows the thing. A local stack has no lakehouse and no
model, so it gives page chrome and empty states. That is honest context for a ticket about a panel
and useless for a ticket about an answer.

Do not invent a screen for work with no visible surface. A rate limit, a durable write and a
removal guarantee get none, and saying so is better than a decorative picture.

## When to scaffold

When real screens need an implementation and time allows, build a reference implementation on a
local branch that is never pushed. It also gives a junior developer something to read.

Ask the scope once, with three options and a recommended default. Read path plus UI is the usual
one. Then:

1. Work in a worktree off `main`, on a separate database and separate ports, so the scaffold cannot
   touch the stack you use.
2. Run `pnpm install` and build the workspace packages. Copy the env file and add the values from
   `apps/backend/.env.example` for every key added since the copy, or the backend refuses to boot.
3. Rebuild `@repo/api` and restart the backend after any contract change.
4. When screens come out thin, check that the web app points at the right backend port before
   blaming the local stack.

Capture with Playwright against fixture data, signed in as `openjii-local-stack` describes. The
privacy rules in `openjii-docs-update` apply to anything a ticket shows.

## What a screen may show

- Only what the acceptance criteria describe. A filter nobody asked for, a count nobody asked for
  or a role that does not exist all had to be removed from earlier screens.
- Real roles, states and field values from the code, never invented ones.
- No test prefixes such as `[Local]` or `[Seed]` in names.
- Copy in the product's spelling. Grep `packages/i18n/locales/en-US`.

## Marking the change

Outline the area that changes and label it with a short tag. The tag must not cover the thing it
points at. Crop to the part that changes plus enough context for a reader to find it.

## Captions

A caption describes the picture. "Sketch: Save to dashboard is one step from the answer" is a
caption. A caption that describes the ticket while the image shows something else is worse than
none, because the reader trusts it. Say plainly when a capture is empty for a local reason, as in
"Empty locally because no turns have run". Never imply the feature works when it does not.

One or two screens go in the body. More go in the ticket's first comment.

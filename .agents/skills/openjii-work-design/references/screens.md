# Screens for tickets

Every ticket that changes a screen carries a picture of the change in its body. The default way to
get that picture is to build the change and photograph the real app with it in place. A developer
new to the area learns more from the product with the change in it than from a drawing, and the
scaffold behind the picture gives them code to read. Thoroughness beats speed here, so do not skip
the scaffold to save time. Where the picture goes and how it is captioned is in
`docs/agents/ticket-standard.md` under "A ticket is read cold".

## Scaffold the change

1. Ask the scope once, with three options and a recommended default, then proceed on the answer.
   The usual default is the read path plus the UI: the contract change in `packages/api` and the
   screens, with no backend writes and no tests.
2. Work in a worktree off `main` on a local branch, with its own database and its own ports, so the
   scaffold cannot touch any other stack. Push it only when the person asks.
3. Run `pnpm install` and build the workspace packages. Copy the backend env file and add every key
   added to `apps/backend/.env.example` since, or the backend refuses to boot.
4. Seed generic example entities whose names say they are examples, such as "Drought trial (example
   data)" and "Sensor fleet (example data)".
5. Build each ticket's change just far enough to be photographed. The scaffold exists to be
   captured and read, not merged.

Scaffold work runs long, so post a one-line progress note between phases.

## Fill the screens that need data

A local stack has no lakehouse, so every data view is empty until something answers for it. Do not
put an empty screen in a ticket about data. Answer the requests in the browser instead, with the
fixtures in `apps/e2e/ticket-screens`, which `apps/e2e/README.md` describes under "Ticket screens":

- A fixture warehouse answers one experiment's data routes (the table list, the rows, the columns
  and the distinct values) from fixture tables. It applies the filter, aggregation, join and
  computed-column semantics the backend's SQL builder gives them, so a chart draws what it would
  draw on real data.
- A fixture session answers as a non-member or a signed-out visitor, for screens about access.
- A fixture route returns a fixed body for one path. Use it for a state the database cannot hold
  yet, such as a chart type the `chart_type` enum does not have.
- Every shot drops `[Seed]` and `[Local]` from names on its own, so the standard seed can be used.

A contract change on the scaffold branch extends the fixture warehouse on the same branch, so the
fixtures always answer the contract the screen is built against.

Fixture rows use real column types, roles, states and field values from the code.

## Capture

Add one shot per ticket to `apps/e2e/ticket-screens/shots.ts` on the scaffold branch, then run
`pnpm --filter @repo/e2e capture-ticket-screens` against the scaffold's stack with `E2E_BASE_URL`
pointing at it. It captures at a device scale factor of 2 in light mode with reduced motion, hides
the Next.js and TanStack Query developer overlays, and saves the failed frame beside any shot that
stops, so the cause is visible.

- Restart the backend after every `@repo/api` build, or it validates requests against the old
  contract.
- Radix selects and menus mark the rest of the page `aria-hidden` while they are open, so role
  queries find nothing. Locate elements with CSS while a menu is open.
- Expand collapsible sections before the shot.
- Round relative time windows to the minute, or the query key changes on every render and the view
  refetches in a loop.
- When screens come out thin, check that the web app points at the scaffold's backend port before
  blaming the stack.

The privacy rules in `openjii-docs-update` apply to anything a ticket shows.

## Draw only where the app cannot show it

Draw a sketch only where the app cannot show the change honestly even with fixtures: a language
model's answer, a flow that needs a physical device, or a screen whose layout is itself the open
question. Draw it in the platform's tokens, type and component chrome, starting at
`apps/web/app/globals.css`, so a reader sees the product and not a wireframe. Linear needs a PNG, so
render one, and caption it `Sketch:`.

Do not make a screen for work with no visible surface. A rate limit, a durable write and a removal
guarantee get none, and saying so is better than a decorative picture.

## What a screen may show

- Only what the acceptance criteria describe. A filter nobody asked for, a count nobody asked for
  and a role that does not exist all had to be removed from earlier screens.
- Real roles, states and field values from the code, never invented ones.
- No study names, instrument terms or test prefixes such as `[Local]` or `[Seed]`.
- Copy in the product's spelling. Grep `packages/i18n/locales/en-US`.

## Mark the change

Outline the part that changes in one accent colour and put a short tag such as `New` beside it,
placed so the tag does not cover what it points at. Leave the rest of the product untouched. Crop
to the changed part plus enough context for a reader to find it on the page. `ChangeMarker` does
both: `mark` draws the outline and tag, and `frame` returns the crop a shot hands back.

## Captions

A caption describes the picture. "Save to dashboard is one step from the answer" is a caption. A
caption that describes the ticket while the image shows something else is worse than none, because
the reader trusts it. Say plainly when a capture is empty for a local reason, as in "Empty locally
because no turns have run", and never imply the feature works when it does not.

One or two screens go in the body. More go in the ticket's first comment.

## Pilot

Show three tickets with their screens and get a yes on voice and images before capturing the rest.

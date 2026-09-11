# Web media capture

Screenshots and recordings of `apps/web` for `apps/docs/content`. The phone
equivalent is `../mobile`, driven by `apps/docs/scripts/capture-mobile-media.sh`.

## The frame

Documentation media has to show **recognizable desktop product geometry**. A
1440 or 1120 px viewport renders openJII at proportions a reader reads as a
small tablet, so there is exactly one landscape class and it is a real desktop:

| Class     | Viewport    | Density | Published   | Use it for                                       |
| --------- | ----------- | ------- | ----------- | ------------------------------------------------ |
| `desktop` | 1920 x 1200 | 1x      | 1920 x 1200 | Every platform screenshot and recording          |
| `tablet`  | 1024 x 768  | 2x      | 1536 x 1152 | Only docs that explicitly teach tablet behaviour |
| `mobile`  | 390 x 844   | 3x      | 1080 wide   | Only docs that explicitly teach phone behaviour  |

Rules that follow from that:

- **Never upscale.** A narrower viewport is re-rendered at 1920, not stretched.
- **Dialogs use the same viewport.** Frame a detail state by driving the product
  UI (open the dialog, filter the list, scroll the panel), never by shrinking the
  browser or cropping the result.
- **Tablet and mobile are not substitutes.** They document tablet and phone
  behaviour; they never stand in for a desktop shot.

Stills publish as WebP at quality 90, recordings as VP9 WebM at 1920 x 1200,
never as GIF. Every recording also publishes a `-poster.webp` first frame for
the docs `<video poster>` attribute.

## Capturing

Bring the local stack up first (`pnpm db:setup`, `pnpm --filter database db:seed`,
`pnpm dev:fb`, `pnpm local:login`), then:

```sh
pnpm --filter @repo/e2e capture-docs-media --list
pnpm --filter @repo/e2e capture-docs-media --only dashboard,experiments-list
pnpm --filter @repo/e2e capture-docs-media --theme dark
```

Shots are declared in `apps/e2e/docs-media/shots.ts` and frames in
`apps/e2e/docs-media/frames.ts`. A shot with a `perform` step is a recording;
one without is a still. The tool suppresses the Next.js and TanStack Query
development overlays, dismisses the cookie banner, and freezes animation for
stills. It does not otherwise alter what the product renders.

Shots that create account state (passkeys, API keys) clear the existing rows
first, so a rerun publishes one row rather than a growing list and leaves the
local account no more populated than it started.

## Secrets

`shots.ts` carries an `assertNoSecretVisible` guard, and the API-key shot fails
rather than screenshot a page still showing the one-time key. Any new shot that
can surface a credential must call it too. A published screenshot of a working
key cannot be un-published.

## Publishing

Captures land in `apps/docs/.capture/web` for review and are **never** copied to
`public/img` automatically. Before publishing, review every frame at full size
for credentials, tokens, real user or experiment content, precise locations and
dev-only UI. Use only the seeded development identity. Then copy the file to its
`publish` path and record its checksum and disposition in `manifest.json`.

Play any recording end to end before publishing; a sampled contact sheet is not
sufficient.

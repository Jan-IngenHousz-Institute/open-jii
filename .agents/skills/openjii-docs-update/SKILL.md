---
name: openjii-docs-update
description: Update the openJII documentation site and its screenshots when a user-facing feature changes on web or mobile. Use whenever a change alters what a user sees or does, when docs reference a screen that moved, or when screenshots need re-capturing.
---

# Docs and screenshots follow the feature

Read `AGENTS.md` first. **If a change alters what a user sees or does, the docs change in the same
PR.** Docs that describe a screen which no longer exists are worse than no docs.

## Decide what actually needs touching

Ask what a reader would now do differently. If the answer is nothing, skip — not every change is a
docs change. If something moved, was renamed, gained a step, or looks different, it needs an edit.

Content lives in `apps/docs/content`:

- `guide/` — task-oriented user documentation (get-started, measuring, experiments,
  devices-protocols, data-analysis, sharing, reference).
- `developers/` — architecture and API material.

Find the affected pages by searching the content tree for the feature's terms rather than guessing
which file owns it. Check `meta.json` when adding a page — nav order is explicit, not alphabetical.

## Screenshots

**Never fabricate, crop-and-reuse, or hand-edit a screenshot to look current.** Re-capture it.

### Mobile

Use the existing capture script; do not hand-roll `adb screencap` for docs:

```bash
apps/docs/scripts/capture-mobile-media.sh preflight
apps/docs/scripts/capture-mobile-media.sh screenshot <slug>
apps/docs/scripts/capture-mobile-media.sh record <slug> [seconds]
```

Getting a device attached is the `openjii-mobile-device` skill; driving it to the right screen is
`openjii-mobile-control`.

**The privacy rules are not optional and the script enforces part of them:**

- Captures land in `apps/docs/.capture/mobile` for review. They are **never** copied to
  `public/img` automatically, and you must not copy them there without a human reviewing every
  frame.
- Use a non-sensitive development account only. Real experiment names, member names and email
  addresses must not appear.
- After a human publishes an asset, record its checksum in `apps/docs/media/mobile/manifest.json`.

### Web

After the user authorizes resetting local data, bring the stack up (`pnpm db:setup`,
`pnpm --filter database db:seed`, `pnpm dev:fb`), obtain a development session with
`pnpm local:login`, and capture the real authenticated UI rather than a login wall.

Use the capture tool rather than ad-hoc Playwright, so every asset lands on the one
published frame:

```bash
pnpm --filter @repo/e2e capture-docs-media --list
pnpm --filter @repo/e2e capture-docs-media --only <slug,slug>
```

Shots are declared in `apps/e2e/docs-media/shots.ts`; add one there instead of writing a
throwaway script. The frame, the viewport classes and why they are what they are live in
`apps/docs/media/web/README.md` — read it before choosing a viewport, and never crop a
capture to fake a detail shot.

Same staging and privacy rules as mobile: captures land in `apps/docs/.capture/web`, a
human reviews every frame, and the checksum goes in `apps/docs/media/web/manifest.json`.

## Validate before you finish

`apps/docs/scripts` holds the checks the site expects — at minimum run the internal-link check, the
media-reference check, and the local validation script, after editing. Broken relative links are the
most common breakage when pages move, and they will not show up by eye.

```bash
pnpm --filter docs check-links
pnpm --filter docs check-media-references
pnpm --filter docs validate:local   # needs a build first
```

`check-media-references` is what catches an image path that no longer resolves, and a published web
capture that drifted off the standard frame. The link crawler only follows anchors, so it will not.

## What to report

State which pages you changed and why, which screenshots were re-captured versus left alone, and
anything you found documented that no longer matches the product. Stale docs you noticed but did not
fix are worth listing — someone else can pick them up.

## A note on automating this

A repo-committed skill cannot force this to happen. The Stop hook in `.claude/settings.json` reminds
Claude Code once per session when user-facing files changed without docs; it is a nudge, not
enforcement, and other agents do not run it. A PR checklist item or a CI check on user-facing paths
is the portable equivalent.

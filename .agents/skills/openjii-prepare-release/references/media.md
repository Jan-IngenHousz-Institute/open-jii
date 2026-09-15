# Capture release media

Start with a shot list tied to included changes: route/screen, state, theme, viewport, intended note
and what the frame proves. Do not capture pending UI from an older dev deployment and label it as
the candidate. Record the app SHA/build, URL or native version, timestamp, account type, flag state,
file path and review status. An unknown deployed SHA is a gap in evidence.

## Web

Read `apps/docs/media/web/README.md` for frame sizes and review rules. Desktop captures use
1920 x 1200; use a separate mobile viewport only for actual responsive behavior.

For a local seeded stack, read the `openjii-local-stack` and `openjii-docs-update` skills. Reuse:

```sh
pnpm --filter @repo/e2e capture-docs-media --list
pnpm --filter @repo/e2e capture-docs-media --only dashboard,experiments-list
pnpm --filter @repo/e2e capture-docs-media --only dashboard,experiments-list --theme dark
```

Shot definitions live in `apps/e2e/docs-media/shots.ts`. Captures stage in `apps/docs/.capture/web`,
or `OPENJII_CAPTURE_STAGING_DIR`. The runner reads local Postgres IDs, some shots delete/create
account fixtures, and some pin feature flags. Use it only on the authorized local seeded stack.
Flag-pinned shots can illustrate a proposed screen but cannot prove public availability. Read the
selected shot before execution. Database reset needs existing authorization or a separate choice.

For **deployed dev** at `https://dev.openjii.org`, use the available Playwright/browser skill with
an authenticated development profile. In Traycer use its browser REPL. Discover that tool's current
methods; it is a Playwright-shaped subset, and supports viewport screenshots rather than Playwright's
`path`/`fullPage` options. Elsewhere use the installed Playwright skill's session and capture API.

Inspect the page, navigate by visible roles/labels, set the frame, wait for the relevant data to
settle, then capture. Use a dedicated non-sensitive dev account. Obtain an OTP through the human
login flow if needed; `pnpm local:login` cannot read deployed dev's OTP from local Postgres. When a
login challenge blocks capture, ask for the browser handoff and continue the rest of the packet.
Do not put login credentials in a recording. Check the dev deployment job's actual SHA against the
candidate; a recent successful run alone does not establish a match for every app.

If the tool returns an attachment instead of a file, record its attachment ID and export it through
the tool's supported mechanism before preparing a CMS upload. A chat screenshot with no exported
asset is evidence only. Do not invent an output path. Use an available recorder for video; if the
browser has no recording capability, report that limit and offer stills or the local capture runner.

## Android

Read `openjii-mobile-control` to drive a connected development phone, and `openjii-mobile-device`
only if installation/connection is needed. Read `apps/docs/media/mobile/README.md` before capture.
Use the existing helper, which handles detached OEM recorders and removes metadata/audio:

```sh
apps/docs/scripts/capture-mobile-media.sh preflight
apps/docs/scripts/capture-mobile-media.sh screenshot release-home
apps/docs/scripts/capture-mobile-media.sh record release-measurement-flow 30
```

It expects exactly one ready ADB device with `com.openjii.app` installed. It stages files in
`apps/docs/.capture/mobile`, or `OPENJII_CAPTURE_STAGING_DIR`. Multiple devices or a different package
need an explicit target and compatible capture method, not a guessed device. Start longer recordings
in a background shell and navigate while they run; inspect the resulting file after completion.

Have the user confirm the non-sensitive account and dev environment. Do not infer login state from
hierarchy dumps, storage, logs or network inspection. Once that is established, use the phone-control
skill to navigate, observing before each action. Never unlock the phone or automate an authentication
challenge. Select flows that avoid changing remote data during a mock; real measurement demos need
the corresponding physical sensor and permission for their test data.

## Review and attach

Inspect every image at full size and watch every recording end to end. A human must review every
frame before public media publication under the repo's capture rules. Check credentials, names,
emails, device identifiers, notifications, locations and private experiments. Recapture unsuitable
content with safe data. Do not retouch a screenshot to claim a state the product did not render.

Record file hashes and intended note placement in the packet. If publishing docs assets, follow the
repo's manifests and checks; for CMS assets use the Contentful recipe. Missing login, build, device,
sensor, recorder, or privacy review is a blocker for that shot, not proof the feature is broken.

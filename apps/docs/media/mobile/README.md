# Mobile media capture

Ticket 07 captures use the installed production Android package while it is
signed into the dev environment. Run the capture helper from the repository
root:

```sh
apps/docs/scripts/capture-mobile-media.sh preflight
apps/docs/scripts/capture-mobile-media.sh screenshot app-home
apps/docs/scripts/capture-mobile-media.sh record measurement-flow 60
```

The helper stages files under `apps/docs/.capture/mobile`; it never publishes
them. Before copying an asset to `public/img/mobile`, review the entire image or
video for credentials, tokens, notification contents, private datasets,
precise locations, account-linked device lists, and dev-only/feature-flagged
UI. Record the final checksum and disposition in `manifest.json`.

Do not use UI hierarchy dumps, app storage, logs, or network inspection to infer
login state. A human must confirm the environment and account. Never automate a
phone unlock or authentication challenge.

The NX789J used on 2026-07-19 has an OEM `screenrecord` behavior that may detach
the encoder from the ADB client. The helper waits for the device-side process
and refuses missing/empty output. Interactive MultispeQ and multi-device videos
still require the relevant physical hardware.

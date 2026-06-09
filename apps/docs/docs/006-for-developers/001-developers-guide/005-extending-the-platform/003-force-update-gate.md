# Force-Update Gate

A force-update gate is a CMS-managed, full-screen screen that blocks the **mobile app** when the running app version is below a minimum you set. When a breaking change ships, raise the minimum version on the existing `PageForceUpdate` entry in Contentful. Anyone on an older version is then shown a full-screen screen with an update button and can't use the app until they update. Unlike [alert banners](./002-alert-banners.md), it is non-dismissable and replaces the whole app rather than showing a banner.

> Mobile only. The web app is always served at its current version, so it has no force-update gate.

---

## Content type fields

Only **one** `PageForceUpdate` entry is used (the most recently published). All fields are required except `effectiveAt`.

| Field          | Type                | Notes                                                                                                                                             |
| -------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `internalName` | Short text          | Editor label only.                                                                                                                                |
| `title`        | Short text          | Heading on the gate screen.                                                                                                                       |
| `body`         | Rich text           | Message shown under the title.                                                                                                                    |
| `updateCta`    | ComponentButton ref | The button at the bottom of the gate. Set its `label` to the button text and its `url` to the store listing it should open.                       |
| `minVersion`   | Short text          | Minimum allowed version as `MAJOR.MINOR.PATCH` (e.g. `1.28.0`). Users below it are gated. Match the release version exactly — no `v` or suffixes. |
| `effectiveAt`  | DateTime            | **Optional**. The gate only applies from this time (for coordinated rollouts). Blank or in the past → applies immediately.                        |
| `active`       | Boolean             | Master kill switch. `false` removes the gate for everyone, regardless of version.                                                                 |

---

## How the gate decides

On launch and on app resume, the app reads its own version and compares it to the published config. A user is gated only when **all** of these hold:

1. `active` is `true`,
2. `effectiveAt` is blank or in the past, and
3. the running app version is **below** `minVersion`.

The running version is read live from the installed binary (`expo-application`) — it is never cached. So when a user updates, the gate clears automatically even if the cached gate is still around. Comparison is by `MAJOR.MINOR.PATCH` (suffixes like `-beta` are ignored), and an unparseable version never gates (fail-safe).

The version the gate compares against is the one stamped by the mobile release pipeline from the `mobile-v<x.y.z>` tag, so `minVersion` should always use that same `MAJOR.MINOR.PATCH` scheme.

---

## Caching, offline, and propagation

- The config is cached for **5 minutes** (like alert banners). After publishing, expect up to 5 minutes before all users see the change; it is also re-checked whenever the app returns to the foreground.
- The gate works **offline**: the last successfully fetched config is persisted, so a gated user who can't reach Contentful still sees the cached gate. Going offline never unlocks a gated user.
- **OTA caveat**: an over-the-air (JS-only) update does not change the native version the gate reads. `minVersion` gates users by their installed **native** (store) version, so an OTA-only release won't trigger or lift a gate.
- **Local dev builds are never gated** — they report a placeholder version, so a live production gate won't trap developers.

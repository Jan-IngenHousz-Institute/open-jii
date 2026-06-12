# Alert Banners

Alert banners are CMS-managed notices that appear at the top of the web app and mobile app without a code deploy. A content editor publishes a `ComponentAlert` entry in Contentful; the apps pick it up within five minutes.

---

## Content type fields

| Field          | Type                | Notes                                                                                                                                            |
| -------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `internalName` | Short text          | Used as the dismissal key. Change it to re-show the banner to users who previously dismissed it. Falls back to the Contentful entry ID if blank. |
| `title`        | Short text          | Bold headline in the banner.                                                                                                                     |
| `body`         | Rich text           | Body shown after the title, separated by a bullet. Keep it short.                                                                                |
| `type`         | Short text          | Drives the icon. Valid values: `info`, `degraded_service`, `maintenance`, `new_feature`.                                                         |
| `severity`     | Short text          | Drives the banner color. Valid values: `info` (teal), `warning` (yellow), `critical` (red).                                                      |
| `dismissible`  | Boolean             | `true` → user can close it; `false` → no close button.                                                                                           |
| `link`         | ComponentButton ref | Optional CTA at the right edge of the banner.                                                                                                    |
| `audience`     | Short text          | `web`, `mobile`, or `both`.                                                                                                                      |
| `startAt`      | DateTime            | When the banner starts appearing. Required.                                                                                                      |
| `endAt`        | DateTime            | When it stops. Leave blank for indefinite.                                                                                                       |
| `active`       | Boolean             | Immediate kill switch — set to `false` to stop the alert regardless of schedule.                                                                 |

Multiple active alerts stack by severity: `critical` → `warning` → `info`.

---

## Caching and propagation delay

Both web and mobile cache the active alert list for **5 minutes**. After publishing or unpublishing a Contentful entry, expect up to 5 minutes before the change reaches all users. Preview mode on the web app bypasses the cache so editors can verify immediately.

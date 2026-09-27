# PostHog

The openJII PostHog project (EU cloud, project 80726) as code, through the
[PostHog provider](https://registry.terraform.io/providers/PostHog/posthog/latest).

Every environment shares that one project, because the organisation is on PostHog's free plan,
which allows a single project, and events carry an `environment` property to tell them apart. The
project belongs to neither environment, so only the dev root includes this module: it applies on
every merge to main, so a change here goes live when its pull request merges rather than with the
next prod promotion. Prod's root does not touch PostHog. On a paid plan, each root would own a
project of its own (`posthog_project`) instead.

## Layout

`main.tf` holds openJII's configuration and wires it into one generic submodule per kind of object,
the way `modules/opennext` composes its parts:

| Submodule                  | Creates                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `posthog-project-settings` | the project settings this module owns                              |
| `posthog-feature-flag`     | one flag, called once per entry in `flags.json`                    |
| `posthog-action`           | one action                                                         |
| `posthog-dashboard`        | one dashboard with its insights and layout, from `dashboards.json` |
| `posthog-hog-function`     | one hog function: the GeoIP transformation and each error alert    |

## Changing things

- **A feature flag:** edit `flags.json`. A release or a rollback is a pull request, and a toggle
  made in the PostHog UI shows as drift on the next plan. A test in `packages/analytics` holds its
  keys equal to the ones the code checks, so a flag cannot be renamed on one side only.
- **A dashboard or insight:** `dashboards.json` lists them and their tiles, and each insight's query
  is its own file in `insights/`. To bring over a change made in the UI, copy the insight's query
  JSON into that file. The API adds a `version` to each query it serves that PostHog does not
  store, so leave it out.
- **Transformations:** the GeoIP transformation PostHog set up with the project is the `geoip`
  module in `main.tf`, its code in `transformations/`.
- **Error alerts:** the `error_alert` modules post new, reopened and spiking issues to dev's Slack
  webhook, for every environment, since issue events do not say which one they came from. Set
  `error_alerts_enabled = false` while a deploy that newly reports errors opens its first burst of
  issues, then triage and turn it back on.

## What stays in PostHog

Everything else in the project is here. What is not:

- People: members and the **IoT devices testers** cohort, whose members are listed by email while
  this repository is public. Flags and filters refer to the cohort by id (182121).
- What the provider cannot manage: session replay playlists and error-tracking suppression rules.

## Access

OpenTofu reads a personal API key from `TF_VAR_posthog_tofu_api_key`, which the workflows fill
from the `POSTHOG_TOFU_API_KEY` secret of the dev GitHub environment. It needs write access to the
project's settings, feature flags, actions, insights, dashboards and hog functions.

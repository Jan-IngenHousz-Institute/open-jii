# digest-composer

Lambda that composes the platform heartbeat digests from `docs/monitoring/metrics-catalog.yaml` and posts them to Slack. Three EventBridge schedules invoke it with `{ "digest": "observability" | "pulse" | "weekly" }`.

- Observability (06:30 UTC daily): exception report on the environment's Slack webhook. One line on normal days saying nothing is wrong; anomalies render as a severity-grouped table with each one's runbook and triage command under it. Self-check lines report signals that went silent or failed placeholder resolution.
- Pulse (06:35 UTC daily) and weekly (Mon 07:00 UTC): usage levels on the same webhook, each number with a 4-week same-weekday (daily) or week-over-week (weekly) delta.

With an empty webhook variable the Lambda logs the rendered digest instead of posting, so it deploys safely before the Slack channel exists.

## How a digest arrives

Every digest is one message on the environment's Slack webhook, the same one Databricks job
events and Grafana alerts use. The observability digest leads with a table grouped by severity,
critical first, each row led by the catalog number so a line in Slack, a panel on the report and a
runbook all name the same thing. Under the table, each anomaly gets its id, its reading, its
runbook and the triage command for it, most severe first. Slack rejects a message of more than 50
blocks, so on a very bad morning the anomalies that do not fit are left to the report and the
message says how many.

The usage digests are one table each. A level with no reading is named as missing rather than
dropped, so a note that shrank never passes as complete.

## The report each digest links

Slack carries the verdict, not the evidence. Every digest ends in a button to its own
Grafana dashboard, opened at the window that digest just read, so the numbers in the
message and the lines on the report are the same measurement.

| Digest        | Dashboard          | The link opens at |
| ------------- | ------------------ | ----------------- |
| observability | `overnight-health` | the last 24 hours |
| pulse         | `daily-pulse`      | the last 24 hours |
| weekly        | `week-in-numbers`  | the last week     |

Opened from Grafana's own list instead, with no window in the URL, each dashboard falls
back to a wider default: 24 hours, 7 days and 30 days respectively.

`infrastructure/modules/grafana/dashboard/heartbeat.tf` builds all three from the catalog,
one panel per active entry the matching digest reads, so a signal cannot appear on the
report without appearing in the digest. `catalog-consistency.test.ts` fails if the two
filters, the dashboard uid or the placeholder set drift apart.

The link needs a Grafana login. Grafana can publish a snapshot that needs none, but a
snapshot bakes the rendered datapoints and series names into a permanent public URL, which
is the wrong trade for a platform that keeps device and experiment identifiers out of
CloudWatch. With `grafana_endpoint` empty the digests render without the button.

## Where the code lives

`index.js` here is the handler only: CloudWatch queries, Slack delivery, scheduling. Every decision it makes (catalog parsing, placeholder resolution, baselines, anomaly evaluation, rendering) lives in **`packages/monitoring`**, which is a normal workspace package with vitest coverage and is gated by CI like any other package.

## Build

`function.zip` is committed, like the metrics-publisher module, so Terraform stays authoritative and a fresh checkout can plan. Rebuild and commit it after changing the handler, `packages/monitoring`, or `docs/monitoring/metrics-catalog.yaml`.

**Two bundles embed `packages/monitoring`, not one.** A change to the package means rebuilding the forwarder as well, or CI fails on the one you forgot:

```bash
rm -rf packages/monitoring/dist                  # tsc leaves outputs for deleted sources
pnpm turbo run build --filter=@repo/monitoring
(cd infrastructure/modules/monitoring/digest-composer/lambda && npm run build)
(cd infrastructure/modules/monitoring/metrics-forwarder/lambda && npm run build)
```

The lambda build copies the catalog and the whole of `dist/` into the zip. Skipping the package build ships a stale `lib/`, and skipping the `rm -rf` ships compiled files whose sources no longer exist. `Monitoring Lambda Bundle Build` rebuilds all three bundles from a clean checkout and compares them file by file, so both mistakes fail the PR rather than reaching a Lambda.

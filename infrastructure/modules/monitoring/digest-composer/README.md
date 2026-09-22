# digest-composer

Lambda that composes the platform heartbeat digests from `docs/monitoring/metrics-catalog.yaml` and posts them to Slack. Three EventBridge schedules invoke it with `{ "digest": "observability" | "pulse" | "weekly" }`.

- Observability (06:30 UTC daily): exception report to whichever channel its webhook points at. One line on normal days saying nothing is wrong; anomalies render with value vs expectation, runbook link, triage command, and a context blob. Self-check lines report signals that went silent or failed placeholder resolution.
- Pulse (06:35 UTC daily) and weekly (Mon 07:00 UTC): usage levels to whichever channel its webhook points at, each number with a 4-week same-weekday (daily) or week-over-week (weekly) delta.

With empty webhook variables the Lambda logs the rendered digest instead of posting, so it deploys safely before the Slack channels exist.

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

`function.zip` is committed, like the metrics-publisher module, so Terraform stays authoritative and a fresh checkout can plan. Rebuild and commit it after changing the handler, `packages/monitoring`, or `docs/monitoring/metrics-catalog.yaml`:

```bash
pnpm turbo run build --filter=@repo/monitoring   # refresh dist/ first
cd infrastructure/modules/monitoring/digest-composer/lambda && npm run build
```

The build copies the catalog and the compiled package into the zip; skipping the first step ships a stale `lib/`.

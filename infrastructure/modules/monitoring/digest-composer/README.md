# digest-composer

Lambda that composes the platform heartbeat digests from `docs/monitoring/metrics-catalog.yaml` and posts them to Slack. Three EventBridge schedules invoke it with `{ "digest": "observability" | "pulse" | "weekly" }`.

- Observability (06:30 UTC daily): exception report to `#platform-heartbeat`. One green line on normal days; anomalies render with value vs expectation, runbook link, triage command, and a context blob. Self-check lines report signals that went silent or failed placeholder resolution.
- Pulse (06:35 UTC daily) and weekly (Mon 07:00 UTC): usage levels to `#platform-usage`, each number with a 4-week same-weekday (daily) or week-over-week (weekly) delta.

With empty webhook variables the Lambda logs the rendered digest instead of posting, so it deploys safely before the Slack channels exist.

## Where the code lives

`index.js` here is the handler only: CloudWatch queries, Slack delivery, scheduling. Every decision it makes (catalog parsing, placeholder resolution, baselines, anomaly evaluation, rendering) lives in **`packages/monitoring`**, which is a normal workspace package with vitest coverage and is gated by CI like any other package.

## Build

`function.zip` is committed, like the metrics-publisher module, so Terraform stays authoritative and a fresh checkout can plan. Rebuild and commit it after changing the handler, `packages/monitoring`, or `docs/monitoring/metrics-catalog.yaml`:

```bash
pnpm turbo run build --filter=@repo/monitoring   # refresh dist/ first
cd infrastructure/modules/monitoring/digest-composer/lambda && npm run build
```

The build copies the catalog and the compiled package into the zip; skipping the first step ships a stale `lib/`.

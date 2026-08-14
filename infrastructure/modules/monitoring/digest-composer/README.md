# digest-composer

Lambda that composes the platform heartbeat digests from `docs/monitoring/metrics-catalog.yaml` and posts them to Slack. Three EventBridge schedules invoke it with `{ "digest": "observability" | "pulse" | "weekly" }`.

- Observability (06:30 UTC daily): exception report to `#platform-heartbeat`. One green line on normal days; anomalies render with value vs expectation, runbook link, triage command, and a context blob. Self-check lines report signals that went silent or failed placeholder resolution.
- Pulse (06:35 UTC daily) and weekly (Mon 07:00 UTC): usage levels to `#platform-usage`, each number with a 4-week same-weekday (daily) or week-over-week (weekly) delta.

With empty webhook variables the Lambda logs the rendered digest instead of posting, so it deploys safely before the Slack channels exist.

## Build

`function.zip` is committed, like the metrics-publisher module. After changing `index.js` or `docs/monitoring/metrics-catalog.yaml`, rebuild and commit:

```bash
cd lambda && npm run build
```

The build copies the catalog into the zip; an un-rebuilt zip serves the stale catalog.

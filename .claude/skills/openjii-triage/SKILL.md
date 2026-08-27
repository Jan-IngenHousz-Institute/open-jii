---
name: openjii-triage
description: Investigate a platform heartbeat alert or digest anomaly by metric id. Use when a digest line, a Grafana alert, or a runbook points at a metric such as ingest-lag, dlt-heartbeat, or stale-experiments, and you need evidence and a likely cause rather than a guess.
---

# Triage a heartbeat metric

Read `AGENTS.md` first. Invoked as `/openjii-triage <metric-id>`, the id being the one the digest
printed (`ingest-lag`, `stale-experiments`, ...).

Your output is a diagnosis someone can act on: what is happening, since when, the most likely cause,
the evidence you actually pulled, and the next step. Never present an unverified guess as a finding.

## 1. Ground yourself in the catalog, not memory

`docs/monitoring/metrics-catalog.yaml` is the source of truth. Find the entry whose `id` matches and
read it in full. It gives you the namespace, metric name, statistic, dimensions, the rule that fired
(`baseline`), the severity, and the runbook path. **Build your queries from that entry.** Metric
names invented from the id are the most common way this goes wrong.

Then read the runbook it names in `docs/runbooks/`. It lists the likely causes and first moves, which
is your hypothesis list — confirm or eliminate them, don't restate them.

Two entry fields change what you should do:

- `active: false` means nothing publishes it yet. Say so and stop; there is no data to find.
- `source:` tells you where evidence lives — `aws` in CloudWatch, `dbx` in the heartbeat files,
  `pg` in the metrics-publisher Lambda's namespace, `posthog` outside AWS entirely.

## 2. Pull the numbers

Use the catalog's `signal` block verbatim with `aws cloudwatch get-metric-data`. Query the incident
window and the same window on the previous few days, so you can state whether this is a spike or a
level shift.

Three things that produce a confusing empty result:

- **`OpenJII/*` metrics carry an `Environment` dimension** (`dev`/`prod`). Omit it and you match
  nothing, which looks identical to an outage.
- **CloudFront metrics live in `us-east-1`** regardless of where everything else runs.
- **An absent `Sum` counter means zero events, not a broken pipe.** Absent gauges (`Maximum`) are
  the ones that mean the producer stopped.

## 3. Pull the detail the metric deliberately omits

Per-experiment and per-device rosters are kept out of CloudWatch on purpose. For `dbx` metrics they
live in the heartbeat files: `s3://open-jii-heartbeat-<env>/heartbeat/YYYY/MM/DD/HHMMSS.json`. List
the prefix for the incident window, read the newest object, and look for the `detail` lines
(`stale_experiments` and friends). That is where "which experiments" is answered.

For pipeline state, the Databricks jobs and pipelines APIs give run history and the failure message;
the centrum pipeline's own event log carries the underlying error.

## 4. Correlate before concluding

Most incidents are somebody's deploy. Check whether the onset lines up with a recent merge to `main`
(`git log --since`) or a `DORA/Metrics` `DeploymentFrequency` datapoint. A cause that coincides with
a deploy is worth far more than one that merely sounds plausible.

Check the neighbours too — these metrics fail in chains. `stale-experiments` is usually a symptom of
`ingest-lag` or `ingest-forwarding-failures` upstream, and `metrics-mv-freshness` is often downstream
of `dlt-heartbeat`. Diagnose the top of the chain, not the loudest link.

## 5. Report

Lead with the conclusion, then the evidence, then the action. State plainly what you could not check
(missing credentials, an API you could not reach) rather than quietly leaving it out — a triage that
hides its blind spots is worse than one that admits them.

If the investigation taught you something the runbook did not say, add it to that runbook. That file
is the memory this whole system runs on, and a second occurrence should be cheaper than the first.

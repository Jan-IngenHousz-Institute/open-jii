---
name: openjii-triage
description: Investigate a platform heartbeat alert or report anomaly by metric id, or an error-tracking issue by its PostHog issue id. Use when a report panel, a Grafana alert, or a runbook points at a metric such as ingest-lag, dlt-heartbeat, or stale-experiments, or when a PostHog error alert or the daily round names an issue, and you need evidence and a likely cause rather than a guess.
---

# Triage a heartbeat metric

Read `AGENTS.md` first. Invoked as `/openjii-triage <metric-id>`, the id being the alert's `metric_id`
label or the one a daily report chart or tile names (`ingest-lag`, `stale-experiments`, ...). A link
from the report adds the environment and the report's time window after the id; start there.

Your output is a diagnosis someone can act on: what is happening, since when, the most likely cause,
the evidence you actually pulled, and the next step. Never present an unverified guess as a finding.

A UUID instead of a metric id is a PostHog error-tracking issue, from a Slack alert or the daily
round. Skip to "An error-tracking issue" below, then carry on with steps 4 and 5.

Triage reads the sources themselves, so it needs more than the round does: AWS SSO through the
`openjii-prod` and `openjii-dev` profiles for CloudWatch and the heartbeat files, and the devkit's
PostHog key for an error issue. `aws sts get-caller-identity --profile openjii-<env>` says whether
the AWS session is live, and the `posthog:*` commands say when the key is missing. When one is
missing, ask the person to sign in or run the auth command, and never look for credentials in env
files; if they cannot, name what you could not check in the report.

## 1. Ground yourself in the catalog, not memory

`docs/monitoring/metrics-catalog.yaml` is the source of truth. Find the entry whose `id` matches and
read it in full. It gives you the namespace, metric name, statistic, dimensions, the rule that fired
(`baseline`), the severity, and the runbook path. **Build your queries from that entry.** Metric
names invented from the id are the most common way this goes wrong.

Then read the runbook it names in `docs/runbooks/`. It lists the likely causes and first moves, which
is your hypothesis list: confirm or eliminate them, don't restate them.

Two entry fields change what you should do:

- `active: false` means no report dashboard charts it. It does not mean the data is absent:
  some inactive entries have live producers (AWS vitals, PostHog captures) and only lack a rule.
  Read the entry's notes and runbook for which it is, and query the source when one exists.
- `source:` tells you where evidence lives: `aws` in CloudWatch, `dbx` in the heartbeat files,
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

## An error-tracking issue

The devkit reads PostHog with your own key (`tooling/devkit/README.md` has the setup).
`pnpm posthog:issues show <id>` gives the issue's status, events, users, first and last seen, and
the latest exception with its stack. Source maps make web stacks readable; a minified web frame
means that deploy's upload failed.

Then ask PostHog the questions the metric triage asks CloudWatch, with `pnpm posthog:query --query
'<HogQL>'` over `events WHERE event = '$exception' AND issue_id = '<id>'`: when it started, whether
it is one environment or both (`properties.environment`), one app version or all
(`properties.$app_version` on mobile), one route or many. Backend reports carry `route`,
`http_method` and `error_code`, and the backend logs its server errors too, so CloudWatch holds the
lines around one. Web errors from visitors who accepted cookies can link to a session replay on the
issue's page.

Then correlate as step 4 says: an issue that began with a release or a deploy is that change until
shown otherwise.

## 4. Correlate before concluding

Most incidents are somebody's deploy. Check whether the onset lines up with a recent merge to `main`
(`git log --since`) or a `DORA/Metrics` `DeploymentFrequency` datapoint. A cause that coincides with
a deploy is worth far more than one that merely sounds plausible.

Check the neighbours too, because these metrics fail in chains. `stale-experiments` is usually a
symptom of `ingest-lag` or `ingest-forwarding-failures` upstream, and `metrics-mv-freshness` sits
downstream of `gold-materialization-age` and `ingest-lag`. `dlt-heartbeat` is different: when it
fires, the other lakehouse entries do not go stale, they stop reporting, because the same export
writes all of them. Diagnose the top of the chain, not the loudest link.

## 5. Report

Lead with the conclusion, then the evidence, then the action. State plainly what you could not check
(missing credentials, an API you could not reach) rather than quietly leaving it out. A triage that
hides its blind spots is worse than one that admits them.

If the investigation taught you something the runbook did not say, add it to that runbook. That file
is the memory this whole system runs on, and a second occurrence should be cheaper than the first.

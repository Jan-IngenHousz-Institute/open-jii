---
name: openjii-morning
description: Run the morning round over the platform heartbeat. Use at the start of a working day, or after time away, to find out whether the platform needs a person before anybody reports a problem. Reads the digests and the alert state, says what changed, and hands off to openjii-triage for anything that needs digging.
---

# The morning round

Read `AGENTS.md` first. This is the daily counterpart to `openjii-triage`: the round tells you
whether anything needs attention, triage works out why. Same vocabulary, same catalog, same runbooks.

Your output is a verdict a person can act on in under a minute on a quiet day. Lead with whether
anything needs a human. Everything else is supporting detail.

## What you are reading

Three EventBridge schedules invoke `<env>-digest-composer`, which posts to Slack and logs what it
posted. The Slack channels are the intended surface, but the Lambda log is the one you can read
without leaving the terminal, and it carries the same text:

```bash
aws logs tail /aws/lambda/<env>-digest-composer --since 30h --format short
```

Each delivery logs one JSON object. `text` is the rendered digest. A line with
`"delivered": false` means no webhook is configured for that channel and the digest was only
logged, which is normal in an environment that has not been wired to Slack.

`docs/monitoring/metrics-catalog.yaml` is the source of truth for what every line means. Do not
infer a metric's meaning from its name in the digest; look the id up.

## 1. Did the round even happen

Before reading any numbers, confirm the reporter ran. A digest that was never composed looks exactly
like a morning with nothing wrong.

Expect the observability digest and the pulse daily, and the weekly note on Monday. If the composer
did not run, that is the finding, and `docs/runbooks/digest-composer-liveness.md` is the procedure.
Say so and stop; there are no numbers to report.

## 2. Read the self-check lines before the anomalies

The digest reports on its own blind spots, and those lines outrank the content:

- **`could not read <region>`** means CloudWatch queries failed. The metrics that region covers are
  missing from the digest, not healthy. Anything you say about them is unfounded.
- **`unresolved catalog placeholders`** means an entry was dropped before it was ever queried.
- **`no datapoints for <ids>`** means a series that used to report has stopped. For a gauge that is
  usually the producer dying; for a counter it is normal.

A digest with self-check lines is a partial digest. Report it as partial.

## 3. Name what changed, not what is

The point of a round is the delta. Compare today's digest against yesterday's from the same log
window, and say which of these it is:

- **New**: an anomaly that was not there yesterday. This is what deserves attention first.
- **Continuing**: the same anomaly as yesterday. Say how many mornings it has now run, because a
  continuing anomaly nobody has acted on is a decision, not a finding.
- **Cleared**: yesterday's anomaly is gone. Worth one line, because it tells you whether something
  was transient or whether someone fixed it.

A level that moved inside its normal band is not a change. The pulse prints a delta against the
four-week same-weekday baseline precisely so you do not have to judge that by eye.

## 4. Check what the digest cannot see

The digest is a daily exception report. Two things sit outside it:

- **Firing Grafana alerts.** These are the minute-scale signals, and one can fire and resolve
  entirely between digests. The rules carry a `metric_id` label matching the catalog, so a firing
  alert names its own entry and runbook.
- **Thresholds that differ per environment.** Dev's ingest consumer runs on a schedule, so its
  normal lag is hours. A lag anomaly in dev is usually the schedule, not a fault. Check the
  environment before calling it an incident.

## 5. For anything that needs a person

Do not hand over a pointer. Pull the evidence first, then hand over a conclusion.

Read the entry's runbook, take its first diagnostic step, and include what it returned. If the cause
is clear from that, say it. If it is not, invoke `/openjii-triage <metric-id>` and let it do the
deep dive rather than guessing here.

Most incidents are somebody's deploy. Check whether the onset lines up with a merge to `main` before
reaching for anything more exotic.

## 6. Report

Open with one of: nothing needs a person, something needs a person, or the round could not be
completed. Then the changes from step 3, then the evidence for anything in the second category.

Say plainly what you could not check and why. A round that reads confidently past a self-check line
is worse than no round, because it converts an unknown into a false all-clear.

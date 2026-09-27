---
name: openjii-daily-round
description: Run the daily round over the platform heartbeat. Use once a day, or after time away, to find out whether the platform needs a person before anybody reports a problem. Reads Grafana's alert state, the two report dashboards and PostHog's open error issues, says what changed since the last round, and hands off to openjii-triage for anything that needs digging.
---

# The daily round

Read `AGENTS.md` first. This is the standing counterpart to `openjii-triage`: the round tells you
whether anything needs attention, triage works out why. Same vocabulary, same catalog, same runbooks.

Run it once a day, whenever suits. After a few days away you run it once over the whole gap.

Your output is a verdict a person can act on in under a minute on a quiet day. Lead with whether
anything needs a human. Everything else is supporting detail.

## What you are reading

Grafana carries the alerts and the numbers; errors live in PostHog (step 4). Alerts fire and resolve
in Grafana and post to the one Slack channel through Grafana's own notification. The two report dashboards, generated from
`docs/monitoring/metrics-catalog.yaml`, are where the numbers live:

| Dashboard uid            | Reads                                                                | Default window |
| ------------------------ | -------------------------------------------------------------------- | -------------- |
| `<env>-heartbeat-daily`  | what is firing, errors, the data path, rule-backed signals, levels   | 24 hours       |
| `<env>-heartbeat-weekly` | usage, data path and platform against the week before, 90-day trends | 7 days         |
| `<env>-heartbeat-errors` | the error inbox: every open issue with exceptions, by service        | 7 days         |

Every alert rule claims a catalogue entry, and every such entry is a row on the daily report's board,
ordered Web, API and database, Ingest, Lakehouse, Sandboxes. Entries without a rule are the level
tiles beneath it. An entry's chart has its `num` as panel id, so `?viewPanel=<num>` opens it, with
the rule's firing and clearing marked on it.

For a closer look, three dashboards follow a thing through the platform hop by hop, and every
report signal links to the one it sits on:

| Dashboard uid         | Follows                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| `<env>-platform`      | a researcher's request: site, page server, API, database, calibration sandbox  |
| `<env>-data-pipeline` | a device's measurement: IoT Core, the Kinesis stream, lakehouse, macro sandbox |
| `<env>-delivery`      | deploys per service: how often, how many failed, lead time                     |

`<env>-throughput-storage` sits beside them: the ingest stream's throughput against its limits,
and every store's size and growth.

The workspace API needs a service account token. Mint one against the workspace with the AWS CLI
and keep it in your shell for the session, never in a file in the repository:

```bash
WORKSPACE=$(aws grafana list-workspaces --profile openjii-<env> --region eu-central-1 \
  --query 'workspaces[0].id' --output text)
ENDPOINT=https://$(aws grafana describe-workspace --profile openjii-<env> --region eu-central-1 \
  --workspace-id "$WORKSPACE" --query 'workspace.endpoint' --output text)
```

The token itself comes from a service account in that workspace (`aws grafana
create-workspace-service-account-token`); ask for one if you have none. Then:

```bash
# Every rule, with its current state and how long it has been in it.
curl -s -H "Authorization: Bearer $GRAFANA_TOKEN" "$ENDPOINT/api/prometheus/grafana/api/v1/rules" \
  | jq -r '.data.groups[] | .name as $g | .rules[] | "\(.state)\t\($g)\t\(.name)\t\(.labels.metric_id // "-")"'

# Only what is firing right now, with when it started.
curl -s -H "Authorization: Bearer $GRAFANA_TOKEN" "$ENDPOINT/api/alertmanager/grafana/api/v2/alerts" \
  | jq -r '.[] | "\(.labels.alertname)\t\(.labels.severity)\t\(.startsAt)\t\(.annotations.summary // "")"'
```

`docs/monitoring/metrics-catalog.yaml` is the source of truth for what every rule and panel means.
Do not infer a metric's meaning from its name; look the id up.

## 1. Is the reporting itself alive

Before reading any state, confirm the signals are arriving. The `Heartbeat Collector Dead-Man` and
`Metrics Forwarder Errors` rules cover the lakehouse path; if either is firing, every lakehouse
panel is stale and nothing else about them is trustworthy. `docs/runbooks/dlt-heartbeat.md` and
`docs/runbooks/metrics-forwarder-errors.md` are the procedures. A rule in the `Error` or `NoData`
state that should have data is the same finding: say so and treat its signal as unknown.

## 2. Name what changed, not what is

The point of a round is the delta. Compare the alert list against the previous round, and say
which of these each firing rule is:

- **New**: firing now, not at the last round. This is what deserves attention first.
- **Continuing**: firing at the last round too. Say how many days it has now run, because a
  continuing alert nobody has acted on is a decision, not a finding.
- **Cleared**: was firing, is not. Worth one line, because it tells you whether something was
  transient or whether someone fixed it.

A rule that fired and resolved between rounds shows in Slack's history but not in the current
state; a scan of the channel since the last round is part of the round.

## 3. Read the daily report

Open `<env>-heartbeat-daily` at the last 24 hours. Start with the data path. "How much flows"
counts each stage per half hour, from device publishes to macro results; stages that stop
tracking each other mean data is held up or lost between them. "How long each hop takes" gives
each hop's p95. A hop that climbs through the day while volume holds steady is the pipeline
degrading, as the September Centrum heap leak did. "Since last ingest" only means a stall while
publishes keep arriving.

Then the board. Muted green is within the limit the signal's rule enforces, red is a five-minute
reading past it, and a gap is no data. The
tooltip gives the stretch and its duration. Rules hold for minutes before firing, so red whose rule
never fired was a brief breach: open its chart, say when it happened and what the shape was, and
move on unless it repeats. A gap on a signal that should report is a finding in itself. The level
tiles have no limit: say only what moved out of its usual range, and say it as a level, not as a
fault. Dev's ingest consumer runs on a weekday schedule, so its lag is hours by design; check
the environment before calling anything an incident.

## 4. Read the errors

Errors that point at bugs live in PostHog's error tracking, grouped into issues, and its alerts post
new, reopened and spiking issues to the same Slack channel. The daily report's Errors section, right
under what is firing, lists the issues with exceptions over its time range, new ones first, and each
row opens the issue in PostHog or starts triage on it. The error inbox, `<env>-heartbeat-errors`,
holds the same issues over a week, with where each happened and in which app version. A daily report
with no Errors section, or panels saying the plugin is missing, means Grafana cannot read PostHog;
report that as a finding rather than as no errors, with `docs/runbooks/exceptions.md` for the fix.
The devkit reads the same with your own
PostHog key, for a gap the report's window does not cover (`tooling/devkit/README.md` has the setup):

```bash
pnpm posthog:issues list --days 1    # --days covers the gap since the last round
pnpm posthog:issues show <issue-id>  # first and last seen, and the latest stack
```

`list` writes `.claude/posthog/issues-review.json`: every open issue with events in the window, with
its service (`web`, `backend`, `mobile`), environment, app version, events, users and link. Read prod
first. An issue needs a person when it is new since the last round and reaches users on a released
build, or when an old one comes back or spikes. Mobile events from a developer's Metro build carry
`build: development`; those are ours, not researchers'.

Propose each issue that needs a person as a bug or as noise. A bug gets a ticket drafted with
`openjii-ticket-refine`, filed only on the person's word. Noise is set to `suppress` in the review
file; `pnpm posthog:issues apply` prints what it would change, and only `--confirm`, on the person's
word, writes to PostHog. For anything unclear, hand the issue id to `/openjii-triage`.

## 5. For anything that needs a person

Do not hand over a pointer. Pull the evidence first, then hand over a conclusion.

Read the entry's runbook, take its first diagnostic step, and include what it returned. If the cause
is clear from that, say it. If it is not, invoke `/openjii-triage <metric-id>` and let it do the
deep dive rather than guessing here.

Most incidents are somebody's deploy. Check whether the onset lines up with a merge to `main` before
reaching for anything more exotic.

## 6. Report

Open with one of: nothing needs a person, something needs a person, or the round could not be
completed. Then the changes from step 2, the errors from step 4, then the evidence for anything in
the second category.

Say plainly what you could not check and why. A round that reads confidently past a firing
dead-man is worse than no round, because it converts an unknown into a false all-clear.

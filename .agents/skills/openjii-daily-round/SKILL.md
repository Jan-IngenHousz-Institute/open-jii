---
name: openjii-daily-round
description: Run the daily round over the platform heartbeat. Use once a day, or after time away, to find out whether the platform needs a person before anybody reports a problem. Reads Grafana's alert state and the daily report through the devkit with one Grafana token per environment, says what fired, continued and cleared over the window, and hands off to openjii-triage for anything that needs digging.
---

# The daily round

Read `AGENTS.md` first. This is the standing counterpart to `openjii-triage`: the round tells you
whether anything needs attention, triage works out why. Same vocabulary, same catalog, same runbooks.

Run it once a day, whenever suits. After a few days away you run it once over the whole gap.

Your output is a verdict a person can act on in under a minute on a quiet day. Lead with whether
anything needs a human. Everything else is supporting detail.

## 0. What you need

The round itself needs one credential per environment: a token for the `daily-round` Viewer
account, which a developer mints and stores with `pnpm grafana:auth <env>`. Everything else is for
triage, once the round has found something. AWS SSO (the `openjii-prod` and `openjii-dev`
profiles) reaches CloudWatch and the heartbeat files, and the devkit's PostHog key reaches an error
issue's detail and marks noise. A missing triage credential is no reason to stop: carry on, and
name the step it would have taken in your report.

## 1. Read the environment

```bash
pnpm round:read prod
pnpm round:read dev
```

If it refuses the Grafana token as missing or expired, ask the person to mint one and store it as
`tooling/devkit/README.md` shows, and wait. Never mint a token yourself, and never look for one in
env files or credential stores.

Each writes `.claude/round/<env>.json`. Invoked with an environment, as the daily report's header
link does, read that one; otherwise read prod first, then dev. The window is the last 24 hours, or
back to Friday on a Monday. After time away, pass `--since <date of the last round>` so the window
covers the gap. The window stands in for a record of the previous round, so nothing needs saving
between rounds.

The file is too large to read whole; take it apart with `jq`:

- `unavailable`: what could not be read. Everything here goes into your report.
- `rules`: every alert rule, with its `state` (`firing`, `pending`, `inactive`), `health` (`ok`,
  `error`, `nodata`), `activeSince`, `lastError` and `metricId`.
- `delta`: the rules that started firing inside the window (`new`), fired since before it
  (`continuing`, with days), or fired or resolved inside it and are quiet now (`cleared`).
- `changes`: every state change Grafana recorded inside the window, oldest first.
- `panels`: the daily report's open panels over the window. Each series has its `min`, `max`,
  `last` and `sum`, and the `red` stretches where a reading passed its limit; charts keep `points`.

```bash
jq '.unavailable, .delta' .claude/round/prod.json
jq -r '.rules[] | select(.state != "inactive" or .health != "ok") | [.state, .health, .name, .metricId] | @tsv' .claude/round/prod.json
jq '.panels[] | select(.id == 901) | .series[] | select(.red != []) | {name, red}' .claude/round/prod.json
```

Two parts are unconfirmed on Amazon Managed Grafana until a round reads them: that it records alert
state changes as annotations, which `changes` and `cleared` come from, and that the PostHog panels
answer through the API as they do in the browser. A rule in `delta.new` started firing inside the
window, so `changes` must hold its move to `Alerting`. If it does not, or a PostHog panel sits in
`unavailable`, say so in the report, so the person can fix the skill.

`docs/monitoring/metrics-catalog.yaml` is the source of truth for what every rule and panel means.
Do not infer a metric's meaning from its name; look the id up.

## 2. Is the reporting itself alive

Before trusting any state, confirm the signals are arriving. The `Heartbeat Collector Dead-Man` and
`Metrics Forwarder Errors` rules cover the lakehouse path; if either is firing, every lakehouse
panel is stale and nothing else about them is trustworthy. `docs/runbooks/dlt-heartbeat.md` and
`docs/runbooks/metrics-forwarder-errors.md` are the procedures. A rule whose `health` is `error` or
`nodata` while it should have data is the same finding: say so and treat its signal as unknown.

## 3. Name what changed, not what is

The point of a round is the delta, and `delta` sorts it for you:

- **New**: firing now, and it started inside the window. This deserves attention first.
- **Continuing**: firing since before the window. Say how many days it has now run, because a
  continuing alert nobody has acted on is a decision, not a finding.
- **Cleared**: fired or resolved inside the window, quiet now. Worth one line each, from
  `changes`: when it fired and for how long, which tells you whether it was transient or fixed.

## 4. Read the daily report

A person reads the same panels at `<env>-heartbeat-daily` in Grafana; the ids below are its panel
ids. Every alert rule claims a catalogue entry, and an entry's `num` is its chart's panel id.

Start with the data path. "How much flows" (902) counts each stage per half hour, from device
publishes to macro results; stages that stop tracking each other mean data is held up or lost
between them. "How long each hop takes" (903) gives each hop's p95. A hop that climbs through the
day while volume holds steady is the pipeline degrading, as the September Centrum heap leak did.
"Since last ingest" only means a stall while publishes keep arriving.

Then the board (901): one series per rule-backed signal at five-minute readings. A `red` stretch is
a reading past the limit the signal's rule enforces. Rules hold for minutes before firing, so a
stretch whose rule never fired was a brief breach: read the entry's chart for its shape, say when it
happened and what the shape was, and move on unless it repeats.

```bash
pnpm round:read prod --panels 89 --output .claude/round/prod-89.json
```

A gauge whose `lastAt` stops well before the window's end has stopped reporting, which is a
finding in itself; a count that stops means no events, since an absent `Sum` is zero (the catalogue
entry's statistic says which a signal is).

The level tiles, stat panels numbered 100 plus the entry's `num`, have no limit: say only what
moved out of its usual range, and say it as a level, not as a fault. Dev's pipelines have run
continuously since 23 September, yet its ingest lag still peaks above two hours now and then;
check the environment before calling anything an incident.

## 5. Read the errors

Errors that point at bugs live in PostHog's error tracking, grouped into issues, and its alerts post
new, reopened and spiking issues to the same Slack channel. The daily report reads them through
Grafana: the table (906) lists the issues with exceptions over the window, new ones first, and the
tiles beside it count them. A PostHog panel in `unavailable` means Grafana cannot read PostHog;
report that as a finding rather than as no errors, with `docs/runbooks/exceptions.md` for the fix.

An issue needs a person when it is new inside the window and reaches users on a released build, or
when an old one comes back or spikes. Builds on a developer's machine send PostHog nothing, so every
event comes from dev, prod or an installed app.

The devkit reads the same with the PostHog key, a triage credential, for an issue's detail, a gap
the report does not cover, or noise to mark (`tooling/devkit/README.md` has the setup):

```bash
pnpm posthog:issues list --days 1    # --days covers the gap since the last round
pnpm posthog:issues show <issue-id>  # first and last seen, and the latest stack
```

`list` writes `.claude/posthog/issues-review.json`: every open issue with events in the window, with
its service (`web`, `backend`, `mobile`), environment, app version, events, users and link.

Propose each issue that needs a person as a bug or as noise. A bug gets a ticket drafted with
`openjii-ticket-refine`, filed only on the person's word. Noise is set to `suppress` in the review
file; `pnpm posthog:issues apply` prints what it would change, and only `--confirm`, on the person's
word, writes to PostHog. For anything unclear, hand the issue id to `/openjii-triage`.

## 6. For anything that needs a person

Do not hand over a pointer. Pull the evidence first, then hand over a conclusion.

Read the entry's runbook, take its first diagnostic step, and include what it returned. Most first
steps read AWS; if `aws sts get-caller-identity --profile openjii-<env>` says the session has
expired, ask the person for `aws sso login` rather than skipping the step silently. If the cause
is clear from that, say it. If it is not, invoke `/openjii-triage <metric-id>` and let it do the
deep dive rather than guessing here.

`round:read` reads only the daily report. For a closer look a person follows a thing hop by hop
on `<env>-platform` (a researcher's request), `<env>-data-pipeline` (a device's measurement),
`<env>-delivery` (deploys) and `<env>-throughput-storage`; name the one that fits in your hand-over.

Most incidents are somebody's deploy. Check whether the onset lines up with a merge to `main` before
reaching for anything more exotic.

## 7. Report

Open with one of: nothing needs a person, something needs a person, or the round could not be
completed. Name the window it covered. Then the changes from step 3, the errors from step 5, then
the evidence for anything in the second category.

Say plainly what you could not check and why, starting with everything in `unavailable`. A round
that reads confidently past a firing dead-man is worse than no round, because it converts an
unknown into a false all-clear.

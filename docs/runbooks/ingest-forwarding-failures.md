# ingest-forwarding-failures

**IoT Core accepted a device's message and then failed to deliver it.** The broker returned success
to the device, so the device believes the measurement was taken. Rule actions are retried a limited
number of times and then dropped, which makes this the one ingest metric where data is genuinely
lost rather than delayed.

There is no healthy rate of forwarding failure, and the daily report counts every one. The alert waits
for more than five on one rule action within fifteen minutes, held for five, so a single failure
that a retry delivered does not page anyone.

## What is failing

Each ingest channel in `asyncapi.yaml` generates one topic rule with two independent actions:
Kinesis for the pipeline, and Firehose for the raw archive, which buffers messages into large S3
objects rather than writing one per message. Either can fail alone, so establish which:

```bash
aws logs filter-log-events --log-group-name AWSIotLogsV2 \
  --start-time $(( ($(date +%s) - 3600) * 1000 )) \
  --filter-pattern '{ $.eventType = "RuleExecution" && $.status = "Failure" }'
```

The `ruleName` and `reason` fields in the matched events answer both "which channel" and "which
action". If nothing matches, IoT logging may be off for the account, in which case read the
`AWS/IoT` `Failure` metric instead. It is keyed on `RuleName` **and** `ActionType`, so one series
per action already answers "which action", and a query naming only `RuleName` matches nothing:

```bash
aws cloudwatch list-metrics --namespace AWS/IoT --metric-name Failure \
  --query 'Metrics[].Dimensions[].Value' --output text
```

## Likely causes, most common first

- **The action's IAM role was changed or removed.** The rules assume `iot_kinesis_role` and
  `iot_firehose_role` from `infrastructure/modules/iot-core`. A tofu apply that reshaped those
  roles is the usual trigger; the timing usually matches a recent deploy.
- **Kinesis is throttling.** Check `kinesis-write-throttling`. If that is also firing, this is a
  symptom of capacity, not of permissions, and the fix is shards.
- **The Firehose delivery stream is unhealthy**, so the Kinesis half succeeds and the archive half
  does not. Its own delivery errors are on the `open-jii-<env>-iot-raw-archive` stream in the
  Firehose console, not in the IoT logs.
- **Rule SQL is invalid after an `asyncapi.yaml` edit.** The rules are generated from that file at
  plan time, so a malformed channel definition produces a rule that fails at execution rather than
  at apply.

## Recovering the lost window

IoT Core does not keep a message a rule action dropped, but the rule's error action does. Every
message either action failed to deliver lands in the `open-jii-iot-raw-archive-<env>` bucket under
`iot-rule-errors/<yyyy>/<MM>/<dd>/`, by the UTC day it failed, one object per message. Set `DAY` to
the day of the lost window:

```bash
DAY=2026/10/07
aws s3 ls s3://open-jii-iot-raw-archive-<env>/iot-rule-errors/$DAY/
```

Each object names the rule, topic and client, lists every failed action under `failures` with the
resource it failed on and its error, and carries the device's original payload in
`base64OriginalPayload`. Only a message whose Kinesis delivery failed is missing from the pipeline.
One whose failures name only the Firehose stream reached Kinesis and is missing only from the raw
archive; replaying it would count it twice. These are the objects to replay:

```bash
aws s3 cp --recursive s3://open-jii-iot-raw-archive-<env>/iot-rule-errors/$DAY/ ./rule-errors/
jq -r 'select(any(.failures[]; .failedResource == "open-jii-<env>-data-ingest-stream")) | input_filename' ./rule-errors/*.json
```

A message whose Kinesis action failed while Firehose succeeded is also in the raw archive under
`raw-iot/`, but only these objects say which messages the pipeline missed. Establish which action
failed before telling anyone the data is gone, because half the time it is not.

### Replaying it

`pnpm ingest:replay` reads a window of either source, asks bronze which of its messages already
landed, and sends only the missing ones back to the stream, exactly as the rule sent them. The window
is when the messages reached the broker, in UTC, not when they were measured.

- `--source errors` reads the error objects above, for a window in which the rule's Kinesis action
  failed. It sends only the messages whose failures name the stream.
- `--source archive`, the default, reads `raw-iot/`, for a window the pipeline lost after Kinesis,
  such as a consumer stopped for longer than the stream keeps records.

It runs under your AWS profile for the environment, which must hold the infrastructure maintainer
role, the one that may call `kinesis:PutRecords` on the stream, and your Databricks profile.
`--warehouse` takes the id of the environment's Investigations warehouse, which
`databricks warehouses list -p <env>` lists. Start with a dry run, which only reads:

```bash
aws sso login --sso-session openjii
pnpm ingest:replay <env> --source errors --from 2026-10-07T12:00Z --to 2026-10-07T16:00Z \
  --warehouse <warehouse id> [--experiment <experiment id>] [--client <thing name>]
```

It prints a count per decision and writes a manifest of every message it read, with its object, line
and decision, to `.claude/ingest-replays/`. The manifest names devices and measurements, so delete it
once the incident is closed.

- `missing`: not in bronze, and sent on `--apply`.
- `in bronze`: already landed, matched on the phone's record id (`_client_id`), or on the client,
  device and measurement time for a message without one.
- `repeated in the window`: a second copy of a message the window already holds, sent at most once.
- `reached kinesis`: an error object whose failures name only the archive.
- `health check`, `no experiment in its topic` and `no timestamp`: never sent, since none would land
  as a measurement.
- `too large for one kinesis record`: over 1 MiB, which only the large-payload path takes. Recover
  it from that path.

When the counts look right, run the same command with `--apply`. Each record goes to the stream under
the partition key `replay/<run>/<n>`, and a record Kinesis refuses is tried twice more. The command
ends with exit code 1 when any stays refused; run it again, since what landed is then in bronze and
skipped. A few minutes after the pipeline catches up, a dry run of the same window should count no
`missing`. Note the window, the source and the counts in the incident's ticket.

A replay sends no message bronze already holds. One that slips through, such as a message the stream
still held when the replay ran, lands as a second copy with the same `_client_id`, so silver gives
it the same id: the heartbeat's `measurement-copies` counts it, and the serving store and exports
keep one row per id.

### How far back

| Source             | Holds                                         | From                                                                                             | Reach                                                                                     |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| The stream         | every message the rule delivered              | the last 24 hours on dev, 72 on prod                                                             | A consumer stopped for less than that loses nothing; it reads the backlog when it starts. |
| `raw-iot/`         | every message the broker accepted             | dev's first day is 11 May 2026; one JSON object per message until 20 August, gzipped lines since | See below.                                                                                |
| `iot-rule-errors/` | every message a rule action failed to deliver | the error action's start on 7 October 2026; empty while nothing failed                           | See below.                                                                                |

The bucket never deletes. Its lifecycle moves an object to Glacier at 90 days and to Deep Archive at
a year, but S3 moves no object under 128 KB, and the archive's objects are mostly far smaller: dev's
May objects were still in Standard in November. The dry run lists any object in Glacier or Deep
Archive under `restoreFirst` without reading it, and `--apply` refuses to run while there are any.
Restore each for a week, wait for the restore, which takes hours from Glacier and up to 12 from Deep
Archive at the Standard tier, then run again:

```bash
aws s3api restore-object --profile openjii-<env> --bucket open-jii-iot-raw-archive-<env> \
  --key <key> --restore-request 'Days=7,GlacierJobParameters={Tier=Standard}'
```

Neither source holds a publish the broker refused, which stays on the phone until it sends it again,
or a payload too large for the rule, which takes the large-payload path that
`support/measurement-missing.md` covers.

The ingest health check publishes a synthetic message every minute to
`experiment/data_ingest/v1/healthcheck/healthcheck/1/<env>`, so those messages are in the raw
archive and in the error objects too. The replay skips them: they carry no measurement, and replayed
into the stream they would reach `ingest_healthchecks` hours late and lift its latency.

## Closing

Do not close on "the metric returned to zero". Confirm the rule is executing successfully for the
affected channel, then note here which action failed and what changed, because the IAM-shaped causes
recur on the next infrastructure change to that module.

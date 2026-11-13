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
landed, and sends only the missing ones back to the stream. The window is when the messages reached
the broker, in UTC, not when they were measured.

- `--source errors` reads the error objects above, for a window in which the rule's Kinesis action
  failed. It rebuilds each message as the rule's SELECT writes it and leaves out only those whose
  failures all name the Firehose stream.
- `--source archive`, the default, reads `raw-iot/` and sends each line exactly as the rule wrote
  it, for a window the pipeline lost after Kinesis, such as a consumer stopped for longer than the
  stream keeps records. Firehose writes an object up to a quarter of an hour after its first
  message, filed under that message's day, so the command reads every object written from the
  window's start to 20 minutes after its end. It therefore also reads, and can replay, messages
  that arrived up to a quarter of an hour either side of the window.

With `--source archive`, while the newest object read is younger than the stream's retention,
`--apply` refuses to run until bronze holds a message that arrived after that object was written,
on every shard. Until then the stream may still hold messages bronze has not read, and a replay
would land them twice. Only bronze's own rows show this: the stream's other reader, the health
check's, keeps reading while bronze's flow is down. On a stream quiet since the window, wait for
the next measurement to land, or until the newest object is older than the retention. A dry run in
that state warns that messages the stream still holds count as `missing`. `--source errors` skips
the check, since those messages never entered the stream.

It runs under your AWS profile for the environment, which must hold the infrastructure maintainer
role, the one that may call `kinesis:PutRecords` on the stream, and your Databricks profile.
`--warehouse` takes the id of the environment's Investigations warehouse, which
`databricks warehouses list -p <env>` lists. `--apply` writes to the environment's stream directly,
outside the release path, so on prod it is a step a person takes while following this runbook, with
the dry run's counts in the incident's ticket first. An agent runs dry runs only. Run one replay of
an environment at a time: two at once, or one started before bronze has read an earlier one's
records, each count the other's messages as missing. Start with a dry run, which only reads:

```bash
aws sso login --sso-session openjii
pnpm ingest:replay <env> --source errors --from 2026-10-07T12:00Z --to 2026-10-07T16:00Z \
  --warehouse <warehouse id> [--experiment <experiment id>] [--client <thing name>] \
  [--device <device id>]
```

`--client` keeps to one publisher, a phone or a device on its own certificate, and `--device` to
one sensor. It refuses an argument it does not know, so a misspelt filter cannot widen a replay. It
prints its run id first, then a count per decision, and writes a manifest of every message it read,
with its object, line and decision, to `.claude/ingest-replays/`. The manifest names devices and
measurements, so delete it once the incident is closed.

- `missing`: not in bronze, and sent on `--apply`.
- `in bronze`: already landed. A message with the phone's record id (`_client_id`) matches that id
  in any bronze row, including one bronze could not parse. A message without one matches a row
  without one on its client, device, measurement time and sample, since a device can send several
  samples under one time. A row bronze wrote before it kept the record id matches the same way.
  Copies ingested more than 30 days before the window are not looked for, which bounds the scan.
- `repeated in the window`: a second copy of a message the window already holds, sent at most once.
- `reached kinesis`: an error object whose failures all name the Firehose stream.
- `health check`, `no experiment in its topic` and `no timestamp`: never sent, since none would land
  as a measurement.
- `unreadable`: a line or object that is not a message, which nothing can replay.
- `outside the filters`: a count, not a decision: messages `--experiment`, `--client` or `--device`
  left out.

When the counts look right, run the same command with `--apply`. Each record goes to the stream
under the partition key `replay/<run>/<n>`, a batch a second of at most 250 records or 256 KiB. That
is a quarter of what one shard takes, so live ingest keeps the rest, and ten thousand messages take
about 40 seconds. `kinesis-write-throttling` should stay at zero while it runs. A record Kinesis
refuses is tried twice more.

The command ends with exit code 1 when a record stays refused, a request fails, or you stop it. The
first Ctrl-C finishes the batch in hand and still writes the manifest; a second quits at once and
writes none. A failed request or a stop ends the replay early, and the manifest then holds the
messages decided until then, each marked `sent`, `refused`, `unknown` for the batch in flight, or
`not sent`. Before running `--apply` again, wait until a dry run of the same window counts the sent
ones as `in bronze`, and until bronze holds a message that arrived after the failure, since an
`unknown` batch may have landed. A few minutes after the pipeline catches up, a dry run of the same
window should count no `missing`. Note the window, the source and the counts in the incident's
ticket.

The command asks bronze about a thousand messages at a time, but the manifest keeps an entry for
every message read, so split a window of more than about a million messages into several runs.

A replay sends no message bronze already holds. One that slips through lands as a second copy that
silver gives the same id: by the phone's record id, or by what the capture holds when it carries
none. The heartbeat's `measurement-copies` counts it. Silver and the experiment tables keep every
copy, and the serving store and exports keep one row per id. To list the measurements a replay
copied, with the run id the command printed, the day it ran, and the day 30 days before the
window:

```sql
-- Messages with the phone's record id.
SELECT r._client_id, count(*) AS copies
FROM open_jii_<env>.centrum.raw_data r
WHERE r.ingest_date >= '<30 days before the window>'
  AND r._client_id IN (
    SELECT _client_id FROM open_jii_<env>.centrum.raw_data
    WHERE ingest_date >= '<day of the replay>' AND partitionKey LIKE 'replay/<run>/%'
      AND _client_id != ''
  )
GROUP BY r._client_id
HAVING count(*) > 1;

-- Messages without one, matched on their experiment, device, time and sample.
SELECT r.experiment_id, r.parsed_data.device_id, r.parsed_data.timestamp, count(*) AS copies
FROM open_jii_<env>.centrum.raw_data r
JOIN (
  SELECT DISTINCT experiment_id, parsed_data.device_id AS device_id,
         parsed_data.timestamp AS measured_at, sha2(parsed_data.sample, 256) AS sample_hash
  FROM open_jii_<env>.centrum.raw_data
  WHERE ingest_date >= '<day of the replay>' AND partitionKey LIKE 'replay/<run>/%'
    AND _client_id = ''
) replayed
  ON r.experiment_id = replayed.experiment_id
  AND r.parsed_data.device_id <=> replayed.device_id
  AND r.parsed_data.timestamp = replayed.measured_at
  AND sha2(r.parsed_data.sample, 256) <=> replayed.sample_hash
WHERE r.ingest_date >= '<30 days before the window>' AND r._client_id = ''
GROUP BY r.experiment_id, r.parsed_data.device_id, r.parsed_data.timestamp, replayed.sample_hash
HAVING count(*) > 1;
```

### How far back

| Source             | Holds                                         | From on dev                                           |
| ------------------ | --------------------------------------------- | ----------------------------------------------------- |
| The stream         | every message the rule delivered              | the last 24 hours, and 72 on prod                     |
| `raw-iot/`         | every message the broker accepted             | 11 May 2026                                           |
| `iot-rule-errors/` | every message a rule action failed to deliver | 7 October 2026, and empty while no rule action failed |

A consumer stopped for less than the stream's retention loses nothing; it reads the backlog when it
starts. Prod gained each archive at the first release after its dev date, so its first days come
later. `aws s3 ls s3://open-jii-iot-raw-archive-prod/raw-iot/2026/` and the same under
`iot-rule-errors/` show them.

Until 20 August on dev, and the release that followed on prod, `raw-iot/` held one object per
message, so a day from then takes a read per message, four at a time. Since then each object holds a
quarter of an hour of gzipped lines.

The bucket never deletes. Its lifecycle moves an object to Glacier at 90 days and to Deep Archive at
a year, but S3 moves no object under 128 KB, and the archive's objects are mostly far smaller: dev's
May objects were still in Standard in November. The dry run lists any object in Glacier or Deep
Archive that has not been restored under `restoreFirst` without reading it, and `--apply` refuses to
run while there are any. Restore each for a week, wait for the restore, which takes hours from
Glacier and up to 12 from Deep Archive at the Standard tier, then run again. The command reads a
restored object until its restore expires:

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

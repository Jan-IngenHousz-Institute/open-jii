# ingest-idle

**Records are waiting on the ingest stream, but bronze has written nothing for over an hour.** The
consumer, the `Centrum-DLT-Pipeline-<ENV>` pipeline reading Kinesis into `raw_data`, has stopped or
is running without writing. Nothing is lost yet: Kinesis keeps records for 24 hours, and bronze
catches up once it writes again. Everything downstream (experiments, macros, the API) is behind by
the idle time on the daily report.

The heartbeat export measures the idle time every half hour, so the reading can be up to 35 minutes
old. The rule counts only records that arrived 45 to 60 minutes ago, after bronze's last write and
before the reading, so a quiet stream never fires it and neither does a burst after a quiet spell.
In dev, where devices publish in bursts, the board row turns red only after a day idle.

## Stopped, or running without writing

Read the ingest lag beside it. If `ingest-lag` is also firing, the consumer is behind or stopped:
follow `ingest-lag.md`. If the iterator age is near zero while bronze is idle, the consumer is
reading and not writing, which points at the pipeline itself rather than capacity.

```bash
# On Linux, GNU date wants -d '3 hours ago' where BSD date wants -v-3H
aws cloudwatch get-metric-statistics \
  --namespace AWS/Kinesis --metric-name GetRecords.IteratorAgeMilliseconds \
  --dimensions Name=StreamName,Value=open-jii-<env>-data-ingest-stream \
  --start-time "$(date -u -v-3H +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 300 --statistics Maximum
```

A consumer that died completely publishes no iterator age at all, which the ingest-lag rule reads
as no data; this rule is what notices that case.

## Likely causes, most common first

- **The pipeline update failed or stopped.** In the Databricks workspace, open
  `Centrum-DLT-Pipeline-<ENV>` and read its latest update. A cluster that could not start is
  usually capacity rather than code: retry. A failed flow names itself in the event log.
- **A deploy restarted the pipeline and it has not come back.** A deploy starts a new update; one
  that fails to start leaves the pipeline stopped until someone starts it.
- **Bronze rejects what it reads.** A schema change or a bad batch fails the `raw_data` flow while
  the others run. The event log shows the failing flow and its error.

## Drill

Run on dev to show the alert still fires. Stopping and starting the pipeline is done by a person in
the workspace, and publishing needs the infrastructure maintainer profile, the one role allowed to
publish to the ingest topic.

1. Stop `Centrum-DLT-Pipeline-DEV`.
2. Publish a measurement to a test experiment every five minutes until the alert fires. Dev's
   devices are often quiet, and the rule fires only on records waiting.

   ```bash
   aws iot-data publish --profile openjii-dev \
     --endpoint-url "https://$(aws iot describe-endpoint --endpoint-type iot:Data-ATS --profile openjii-dev --output text)" \
     --topic experiment/data_ingest/v1/<experiment id>/multispeq/1.0/drill \
     --cli-binary-format raw-in-base64-out \
     --payload "{\"device_id\":\"drill\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"sample\":\"[]\"}"
   ```

3. Expect the alert 55 minutes after the first record, 45 for it to enter the rule's window and
   10 pending, when bronze had already been idle for an hour. Otherwise the idle reading passes 60
   minutes only at an export, every half hour, so allow up to 100 minutes from the stop.
4. Start the pipeline without a full refresh. Bronze takes the waiting records once its cluster is
   up.

The alert clears at the next export that reads bronze idle for an hour or less, or earlier, when the
last waiting record leaves its window an hour after it arrived, whether or not bronze is writing by
then.

On 2 November 2026 the first record arrived at 15:59:26 UTC, the rule went pending at 16:44:40,
fired at 16:54:40, and its Slack message arrived at 16:55, with bronze idle for 85.9 minutes and
three records in the window. The pipeline was started at about 16:56, bronze took the records at
17:05:54, and the alert cleared at 17:09:40, as the last record, from 16:09:32, left the window.

## Closing

Do not close until bronze writes again: the idle time on the daily report drops to minutes at the
next export, and the ingest-lag line drains back to near zero.

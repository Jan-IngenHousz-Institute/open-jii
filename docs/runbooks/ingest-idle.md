# ingest-idle

**Devices are publishing, but bronze has written no rows for over an hour.** The consumer, the
`Centrum-DLT-Pipeline-<ENV>` pipeline reading Kinesis into `raw_data`, has stopped or is running
without writing. Nothing is lost yet: Kinesis keeps records for 24 hours, and bronze
catches up once it writes again. Everything downstream (experiments, macros, the API) is behind by
the idle time on the daily report.

The heartbeat export measures the idle time every half hour, so the reading can be up to 35 minutes
old. It counts only commits that wrote rows, because the pipeline commits empty micro-batches too.
The rule counts only MQTT publishes IoT Core accepted 45 to 60 minutes ago, after bronze's last
write and before the reading, so a quiet night never fires it and neither does a burst after a quiet
spell. The stream also carries one ingest health check record a minute, which bronze drops from
`raw_data` and which publishes over HTTP, so neither the idle time nor the rule counts it. In dev,
where devices publish in bursts, the board row turns red only after a day idle.

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
the workspace.

1. Stop `Centrum-DLT-Pipeline-DEV`.
2. Publish a measurement to a test experiment over MQTT every five minutes until the alert fires,
   from a dev phone running the mobile app or an MQTT client the dev thing policy lets publish to
   the ingest topic. Dev's devices are often quiet, and the rule fires only on MQTT publishes.
   `aws iot-data publish` goes over HTTP, which the rule leaves out, as it does the health check.
   Confirm the publishes are counted:

   ```bash
   # On Linux, GNU date wants -d '30 minutes ago' where BSD date wants -v-30M
   aws cloudwatch get-metric-statistics --profile openjii-dev --namespace AWS/IoT \
     --metric-name PublishIn.Success --dimensions Name=Protocol,Value=MQTT \
     --start-time "$(date -u -v-30M +%Y-%m-%dT%H:%M:%SZ)" \
     --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     --period 300 --statistics Sum
   ```

3. Expect the alert 55 minutes after the first publish, 45 for it to enter the rule's window and
   10 pending, when bronze had already been idle for an hour. Otherwise the idle reading passes 60
   minutes only at an export, every half hour, so allow up to 100 minutes from the stop.
4. Start the pipeline without a full refresh. Bronze takes the waiting records once its cluster is
   up.

The alert clears at the next export that reads bronze idle for an hour or less, or earlier, when the
last waiting record leaves its window an hour after it arrived, whether or not bronze is writing by
then.

On 2 November 2026, when the rule still counted the stream's records, the first record arrived at 15:59:26 UTC, the rule went pending at 16:44:40,
fired at 16:54:40, and its Slack message arrived at 16:55, with bronze idle for 85.9 minutes and
three records in the window. The pipeline was started at about 16:56, bronze took the records at
17:05:54, and the alert cleared at 17:09:40, as the last record, from 16:09:32, left the window.

## Closing

Do not close until bronze writes again: the idle time on the daily report drops to minutes at the
next export, and the ingest-lag line drains back to near zero.

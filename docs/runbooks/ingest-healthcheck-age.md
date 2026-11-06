# ingest-healthcheck-age

**No ingest health check message has reached the lakehouse for 45 minutes.** A Lambda,
`<env>-ingest-healthcheck`, publishes a synthetic message every minute to
`experiment/data_ingest/v1/healthcheck/healthcheck/1/<env>`. The real ingest rule copies it to
Kinesis and the raw archive like any measurement, and the Centrum pipeline keeps it in its own
`ingest_healthchecks` table, apart from `raw_data`. A quiet night does not move this, because the
message is ours: it is the one alert that says the path from the IoT broker to bronze has stopped,
so measurements may be delayed or lost.

The heartbeat export reads the minutes since the newest message reached Kinesis every half hour, so
the alert follows a stop by 60 to 100 minutes. The age runs on Kinesis's arrival time, not the
sender's clock, because the topic takes any payload. It also fires on No data: a table with no
message, or an export that did not report one.

## Work the path in order

Each hop fails differently, so check them in the order a message travels.

**1. Is the publisher running?** If `ingest-healthcheck-errors` is firing, the path may be fine and
only the probe broken: follow `ingest-healthcheck-errors.md` first.

```bash
aws logs tail /aws/lambda/<env>-ingest-healthcheck --since 15m
```

A run that succeeds logs only Lambda's own start, end and report lines. No lines at all means the
schedule is not invoking it: check the `<env>-ingest-healthcheck-schedule` EventBridge rule.

**2. Did the IoT rule deliver it?** A message the rule failed to deliver is in the rule error
archive, and `ingest-forwarding-failures` is usually firing beside this. Follow
`ingest-forwarding-failures.md`; a failed health check message is one of the objects it lists.

**3. Did it reach the stream?** The stream gets at least one record a minute while the path works,
because of this message alone:

```bash
# On Linux, GNU date wants -d '30 minutes ago' where BSD date wants -v-30M
aws cloudwatch get-metric-statistics \
  --namespace AWS/Kinesis --metric-name IncomingRecords \
  --dimensions Name=StreamName,Value=open-jii-<env>-data-ingest-stream \
  --start-time "$(date -u -v-30M +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 60 --statistics Sum
```

Minutes with no records mean the break is before the stream: the publisher, the broker, or the
rule. If `kinesis-write-throttling` is firing, the stream is refusing writes.

**4. Did the pipeline write it?** Records arriving and the table not moving means the Centrum
pipeline is behind, stopped, or failing on this table alone:

```sql
SELECT max(kinesis_arrival_time) AS newest_arrived, max(ingestion_timestamp) AS newest_written
FROM open_jii_<env>.centrum.ingest_healthchecks
```

If `ingest-idle` or `ingest-lag` is also firing, the pipeline is the cause: follow those. If only
this table is stale, open `Centrum-DLT-Pipeline-<ENV>` and read the event log for the
`ingest_healthchecks` flow, which reads the same stream as `raw_data` but fails on its own.

**5. Did the export report it?** A table that is current while this still fires means the export
did not read it. A failure of the `ingest_healthcheck` collector is in the `failed_collectors` line
`collector-failures.md` shows. If `dlt-heartbeat` is firing, the whole export is down: follow
`dlt-heartbeat.md`.

## Running it again

Publish one by hand rather than waiting for the next minute, then read the table:

```bash
aws lambda invoke --function-name <env>-ingest-healthcheck /dev/stdout
```

The alert clears at the first export that reads a message under 45 minutes old, at most half an
hour later. Run the export from its job, `Metrics-Heartbeat-Export-<ENV>`, to see it sooner.

## Closing

Do not close until the health check's age on the daily report is back to a few minutes at an
export, then note here which hop failed and what changed.

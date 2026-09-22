# kinesis-write-throttling

**Writes into the ingest stream are being rejected for exceeding provisioned throughput.** The IoT
rule retries, and what it cannot place is dropped. Any nonzero value alarms.

## Decide between a burst and a ceiling

```bash
# On Linux, GNU date wants -d '24 hours ago' where BSD date wants -v-24H
aws cloudwatch get-metric-statistics \
  --namespace AWS/Kinesis --metric-name IncomingRecords \
  --dimensions Name=StreamName,Value=open-jii-<env>-data-ingest-stream \
  --start-time "$(date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 300 --statistics Sum
```

A narrow spike against an otherwise flat line is one device or one backfill misbehaving. A line that
has been climbing for days is the fleet outgrowing its shard count, and throttling is the first
place that becomes visible.

## For a spike, find the source

Per-device volume is deliberately kept out of CloudWatch, so it lives in the heartbeat file rather
than in a metric:

```bash
aws s3 ls s3://open-jii-heartbeat-<env>/heartbeat/$(date -u +%Y/%m/%d)/ | tail -5
aws s3 cp s3://open-jii-heartbeat-<env>/heartbeat/YYYY/MM/DD/<HHMMSS>.json - | grep '"detail"'
```

A device republishing its backlog after a long offline period is the usual cause and needs no
infrastructure change, only a check that it stops on its own.

## For sustained growth, add shards

The stream is defined in `infrastructure/modules/kinesis`. Shard count is a capacity decision, not
an incident fix: raising it costs money continuously, so confirm the growth is real before changing
it rather than reacting to one bad afternoon.

## Check what it cost

Throttling and `ingest-forwarding-failures` usually fire together, because a throttled write is a
failed rule action. Read that runbook for whether the affected window is recoverable from the S3
archive, and treat the data question as separate from the capacity question.

# store-feed-latency

**For five minutes, the slowest twentieth of the rows reaching one of the serving store's tables
took over a minute from gold.** A timer on the store's instance measures it once a minute, from
each row's gold commit (`_commit_timestamp`) to its insert (`inserted_at`). Rows still arrive, so
the app reads data that is minutes old rather than missing. If rows stopped arriving altogether,
`store-feed-stalled` fires instead.

The feed's sinks run inside the pipelines that write gold: measurements and uploads in Centrum,
macro results in the macro pipeline. When the store cannot take a batch, the executors hand it back
after about half a minute and the sink waits on the pipeline's driver, then writes the batch again,
so a slow feed is either a store taking inserts slowly or a pipeline reaching its sink late.

The pipelines' logs are in `/Volumes/<catalog>/centrum/pipeline-logs/<centrum|macro>/<cluster id>/`,
the driver's under `driver/` and the executors' under `executor/`. Every line the feed writes starts
with `[serving store]`.

## Work the chain in order

**1. Is it a catch-up?** After a pipeline restart, a deploy or the feed being switched back on, the
sink works through what gold gained meanwhile, and those rows are old by definition. Find the
store's instance and open a session on it:

```bash
aws ec2 describe-instances --filters Name=tag:Name,Values=openjii-serving-store-<env> \
  --query 'Reservations[].Instances[].[InstanceId,State.Name]' --output text
aws ssm start-session --target <instance-id>
```

Then read the minutes in the store, for the table the alert names:

```bash
clickhouse-client --user openjii_monitor --query "
  SELECT toStartOfMinute(inserted_at) AS minute, count() AS rows,
    round(quantile(0.95)(dateDiff('second', _commit_timestamp, inserted_at))) AS p95_seconds
  FROM store.measurements WHERE inserted_at > now() - INTERVAL 1 HOUR
  GROUP BY minute ORDER BY minute"
```

A burst of rows whose p95 falls minute by minute is a catch-up; let it finish. A steady trickle with
a high p95 is not.

**2. Is the store taking inserts slowly?** Each failed insert is logged in the executors' logs with
the store's exception code, and each batch handed back in the driver's:
`[serving store] Insert into measurements failed on attempt 4, retrying in 10 s: HTTP 500, code 241: ...`
and `[serving store] measurements batch 812: 4000 rows not sent, writing the batch again in 30 s`.

- Code 241 is memory: work `store-memory`.
- Code 252 is too many parts, which means merges have fallen behind the inserts. On the instance,
  `SELECT table, count() FROM system.parts WHERE active AND database = 'store' GROUP BY table` shows
  the part counts and `SELECT table, elapsed, progress FROM system.merges` what is merging. A refresh
  catch-up spreads inserts over many months; it settles once the catch-up ends.
- A timeout or connection error with `store-answers` firing means the store is down; work that
  runbook.

**3. Is the pipeline reaching its sink late?** In the pipeline's event log, the flow
`serving_store_<table>_changes` reports each batch. Batches far apart while gold commits often mean
the pipeline's worker is busy, which a catch-up of gold itself also causes. The sink reads at most
128 MB per batch, so it cannot hold the worker for long; if the pipeline stays slow with the feed
on and is fast with it off, it needs a second worker, which is a sizing decision for the pipeline's
owner.

## Closing

Close once the p95 is back under a minute for every table, and name the cause: a catch-up, the
store, or the pipeline.

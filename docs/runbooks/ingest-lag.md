# ingest-lag

**Kinesis iterator age is climbing: producers are writing, the Databricks consumer is not keeping
up or is not running.** Nothing is lost while the age stays under the stream's 24h retention, but
gold tables, experiment freshness and every dashboard built on them fall behind by the age shown.

Severity is critical because the gap grows on its own. At 24h, data starts being dropped by Kinesis
and no amount of catching up recovers it.

## First, decide whether this is the cause or a symptom

Check `ingest-forwarding-failures` and `kinesis-write-throttling` in the same digest. If either is
also firing, fix that first: this metric will recover on its own once the producer side is healthy.

## Confirm the shape

```bash
# On Linux, GNU date wants -d '6 hours ago' where BSD date wants -v-6H
aws cloudwatch get-metric-statistics \
  --namespace AWS/Kinesis --metric-name GetRecords.IteratorAgeMilliseconds \
  --dimensions Name=StreamName,Value=open-jii-<env>-data-ingest-stream \
  --start-time "$(date -u -v-6H +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 300 --statistics Maximum
```

A line climbing at roughly one second per second means consumption has stopped entirely. A sawtooth
that climbs and partly recovers means the consumer is running but too slow, which is a different
problem with a different fix.

## Find out why the consumer stopped

The consumer is the `Centrum-DLT-Pipeline-<ENV>` pipeline. In the Databricks workspace, open it and
read the most recent update.

- **Update failed.** The event log carries the error. A `CLUSTER_LAUNCH_FAILURE` on spot capacity is
  the most common and is not a code problem: retry, and if it recurs, the pipeline needs on-demand
  compute rather than another retry.
- **No update in progress and none scheduled.** Someone paused the pipeline or its scheduler job,
  often during unrelated maintenance. Resume it.
- **Update running but making no progress.** Look at the flow-level progress in the event log. A
  single wedged flow holds the whole update.

If the pipeline is healthy and consuming, the problem is upstream: the stream is receiving more than
the pipeline can process, and the answer is shard count or pipeline compute, not a restart.

## After recovery

Iterator age drains on its own once consumption resumes; it does not need intervention. Watch it
return to near zero before closing. If it plateaus part-way down, consumption restarted but is still
slower than ingest, and you are back to the capacity question above.

Record what the event log actually said here. The failure modes repeat, and the second occurrence
should cost minutes rather than the hour the first one did.

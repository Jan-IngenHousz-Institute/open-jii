# flow-batch-p95

**A flow's batches have slowed down.** Once a flow's batches run back to back, a measurement waits
for the batch in progress and then for its own, so up to about two batch durations. The rule fires
when the slowest twentieth of a flow's batches in an hour took over 30 seconds. From 3 to 17
November 2026 no prod flow's hourly p95 passed 22 seconds, the macro flow's being the highest. A
load test on dev on 17 November held `raw_data` at 20 seconds with 300 messages a second on one
worker, about sixty times prod's busiest hour, so 30 means a flow past that. Nothing is lost yet,
but every slower batch adds to the wait, and [ingest-lag](ingest-lag.md) fires once the stream's
reader is ten minutes behind.

The heartbeat export reads each pipeline driver's log every half hour. An hour reaches the log
volume about an hour after it closes, so the reading is two to three hours old. The alert's
`Pipeline` label names the pipeline: `centrum` for `Centrum-DLT-Pipeline-<ENV>`, `macro` for
`Macro-Execution-DLT-Pipeline-<ENV>`. Its `Flow` label names the table the flow writes: `raw_data`,
`clean_data` and `experiment_raw_data` in Centrum, and `experiment_macro_data` in the macro
pipeline.

## Confirm it

The heartbeat file's `flow_batches` roster gives each flow's batch count, p95 and busy share for the
same hour. The driver logs a progress record for every batch that carried rows, in
`/Volumes/<catalog>/centrum/pipeline-logs/<pipeline>/<cluster id>/driver/log4j-<YYYY-MM-DD-HH>.log.gz`.
The running driver's folder is the one written to last, and its `log4j-active.log` holds the current
hour. Each record starts with `Streaming query made progress:`, and its `batchDuration` is in
milliseconds:

```text
"name" : "__materialization_mat_clean_data_1",
"batchDuration" : 1054,
"numInputRows" : 18,
```

Many rows per batch with longer durations means the load has outgrown the cluster. A few rows per
batch with long durations means each batch costs more than it used to: a schema change, a slower
write, or the driver short of memory ([driver-heap](driver-heap.md)).

## Act

- **Many rows per batch:** give the pipeline's cluster more workers in its OpenTofu definition,
  deploy, restart the pipeline, and read the p95 over the next hours.
- **Batches cost more:** compare the progress records' `durationMs` breakdown with a quiet hour. A
  grown `addBatch` is the write, a grown `latestOffset` or `getBatch` is the read from the stage
  before.
- **The driver is short of memory:** follow [driver-heap](driver-heap.md).

## Closing

Close once the flow's p95 has stayed under 30 seconds for a day. Note which flow and why here, so
the next occurrence starts from it.

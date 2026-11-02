# flow-busy

**A flow that streamed measurements wait on spent most of an hour in batches.** Its batches now run
back to back rather than once per trigger interval, so every extra row adds to how long the next
measurement waits. Nothing is lost yet. The rule fires after two such hours in a row. In prod's
busiest hour of 28 October 2026, the busiest flow spent 18.5% of it in batches.

The heartbeat export reads each pipeline driver's log every half hour. An hour reaches the log volume
about an hour after it closes, so the reading is two to three hours old. The alert's `Pipeline` label
names the pipeline: `centrum` for `Centrum-DLT-Pipeline-<ENV>`, `macro` for
`Macro-Execution-DLT-Pipeline-<ENV>`. Its `Flow` label names the table the flow writes: `raw_data`,
`clean_data` and `experiment_raw_data` in Centrum, and `experiment_macro_data` in the macro pipeline.

## Confirm it

The heartbeat file's `flow_batches` roster gives each flow's batch count and p95 duration for the
same hour. The driver logs a progress record for every batch that carried rows, in
`/Volumes/<catalog>/centrum/pipeline-logs/<pipeline>/<cluster id>/driver/log4j-<YYYY-MM-DD-HH>.log.gz`.
The running driver's folder is the one written to last. Each record starts with
`Streaming query made progress:`, and its `batchDuration` is in milliseconds:

```text
"name" : "__materialization_mat_clean_data_1",
"batchDuration" : 1054,
"numInputRows" : 18,
```

Many rows per batch means load has grown, and the flow is keeping up by taking bigger batches. A few
rows per batch with long durations means each batch costs more than it used to: a schema change, a
slower write, or the driver short of memory ([driver-heap](driver-heap.md)).

## Act

- **Load has grown:** give the pipeline's cluster more workers in its OpenTofu definition, deploy,
  restart the pipeline, and read the share over the next hours.
- **Batches cost more:** compare the progress records' `durationMs` breakdown with a quiet hour. A
  grown `addBatch` is the write, a grown `latestOffset` or `getBatch` is the read from the stage
  before.
- **The driver is short of memory:** follow [driver-heap](driver-heap.md).

## Closing

Close once the flow has spent under 80% of an hour in batches for a day. Note which flow and why
here, so the next occurrence starts from it.

# flow-busy

**A flow that streamed measurements wait on spent most of an hour in batches.** Its batches now run
back to back rather than once per trigger interval, so every extra row adds to how long the next
measurement waits. Nothing is lost yet. The rule fires once about three hours in a row are over 80%,
so a burst of one or two hours stays quiet. In prod's busiest hour of 28 October 2026, the busiest
flow spent 18.5% of it in batches. Since a larger fleet started reporting on 13 November 2026, prod's
quiet hours sit near 35%.

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

More batches at a flat p95 means more messages, not costlier ones. `raw_data` and `clean_data`
trigger every 2 seconds, so each runs a batch whenever a message is waiting, and its share follows
how often messages arrive. A device that reconnects uploads what it buffered at many times its live
rate, and fills an hour by itself. The raw archive shows which: count each file's messages by
`client_id` in `s3://open-jii-iot-raw-archive-<env>/raw-iot/<YYYY>/<MM>/<DD>/`, and compare each
device's `sample[].time.start_utc` with the file's time. A live device sends what it measured in the
file's 15 minutes, while a backlog is hours or days older.

## Act

- **Many rows per batch:** give the pipeline's cluster more workers in its OpenTofu definition,
  deploy, restart the pipeline, and read the share over the next hours.
- **Batches cost more:** compare the progress records' `durationMs` breakdown with a quiet hour. A
  grown `addBatch` is the write, a grown `latestOffset` or `getBatch` is the read from the stage
  before.
- **The driver is short of memory:** follow [driver-heap](driver-heap.md).
- **A device is uploading a backlog:** nothing to do. The share falls once it has caught up.
- **More batches at a flat p95:** more workers are unlikely to help, since the batches are not
  slower. A longer `MEASUREMENT_PATH_TRIGGER_INTERVAL` in
  `apps/data/src/lib/openjii/openjii/centrum/constants.py` lets each batch carry more rows, and a
  measurement may then wait up to that interval before its batch starts.

## Closing

Close once the flow has spent under 80% of an hour in batches for a day. Note which flow and why
here, so the next occurrence starts from it.

- From 15 to 17 November 2026 it fired three times on prod, with `clean_data` at up to 89%. A larger
  fleet had reported since 13 November, which raised `clean_data`'s median hour from about 10% to
  35% with ten times the batches at the same p95. Devices uploading a day of buffered measurements
  then filled single hours. Gold stayed current and Ingest Lag stayed quiet. The rule fired on one
  busy hour then, so it now waits for three.

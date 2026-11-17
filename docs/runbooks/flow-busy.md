# flow-busy

**How much of an hour a flow spent in batches.** It is a row on the daily report and nothing alerts
on it. `raw_data` and `clean_data` trigger every 2 seconds, so each runs a batch whenever a message
is waiting, and the share follows how often messages arrive rather than whether the flow keeps up.
In prod's busiest hour of 28 October 2026 the busiest flow spent 18.5% of it in batches. Since a
larger fleet started reporting on 13 November 2026, prod's quiet hours sit near 35%. Whether a flow
is falling behind is [flow-batch-p95](flow-batch-p95.md).

The heartbeat export reads each pipeline driver's log every half hour. An hour reaches the log
volume about an hour after it closes, so the reading is two to three hours old. The `Pipeline` label
names the pipeline: `centrum` for `Centrum-DLT-Pipeline-<ENV>`, `macro` for
`Macro-Execution-DLT-Pipeline-<ENV>`. Its `Flow` label names the table the flow writes: `raw_data`,
`clean_data` and `experiment_raw_data` in Centrum, and `experiment_macro_data` in the macro
pipeline.

## Reading a high share

The heartbeat file's `flow_batches` roster gives each flow's batch count and p95 for the same hour.
More batches at a flat p95 means more messages, not costlier ones. A device that reconnects uploads
what it buffered at many times its live rate, and fills an hour by itself. The raw archive shows
which: count each file's messages by `client_id` in
`s3://open-jii-iot-raw-archive-<env>/raw-iot/<YYYY>/<MM>/<DD>/`, and compare each device's
`sample[].time.start_utc` with the file's time. A live device sends what it measured in the file's
15 minutes, while a backlog is hours or days older. Either way there is nothing to do.

## Past readings

- From 15 to 17 November 2026 it alerted three times on prod, with `clean_data` at up to 89%. A
  larger fleet had reported since 13 November, which raised `clean_data`'s median hour from about
  10% to 35% with ten times the batches at the same p95. Devices uploading a day of buffered
  measurements then filled single hours. Gold stayed current and Ingest Lag stayed quiet. A load
  test on dev the same day kept `raw_data` over 90% busy from 50 to 300 messages a second while its
  p95 rose only from 6 to 20 seconds, so the alert moved to the batches' p95.

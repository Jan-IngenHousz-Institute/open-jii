# metrics-forwarder-errors

**The forwarder is failing to turn heartbeat files into CloudWatch datapoints.** The files are still
in S3, so nothing is lost yet, but every lakehouse signal in the digest goes quiet until this is
fixed, and quiet is not the same as healthy.

This watches errors and not liveness. The function is S3 event driven, so a day with no heartbeat
file is a day with no invocations, and a liveness rule here would fire on every quiet period.
`dlt-heartbeat` is what notices that files stopped arriving.

## Read what it said before it threw

The handler logs a summary line for every invocation and only then throws, so the log names the
object and the reason rather than just a stack trace.

```bash
aws logs tail /aws/lambda/<env>-metrics-forwarder --since 2h --filter-pattern '{ $.failed[0] EXISTS }'
```

The `failed` array carries the object key and the message. The `skipped` array is different: those
are lines the forwarder rejected on purpose, and they do not fail the invocation.

## The three that actually happen

- **A timestamp outside CloudWatch's window.** `PutMetricData` refuses points older than two weeks
  or more than two hours ahead. A replayed file trips this, and it is the one failure where the
  right action is to leave the object alone.
- **An unrecognised unit or a malformed line.** These are skipped rather than thrown, so they appear
  in `skipped` with a line number. A sudden run of them means the exporter changed shape and
  `apps/data/src/lib/openjii/openjii/heartbeat/observations.py` is where the contract lives.
- **Throttling on PutMetricData.** Retries on its own. Only act if it persists past an hour.

## Retrying an object

S3 retries an asynchronous invocation twice and then drops it, so an object that failed all three
times is not coming back on its own. Re-deliver it by copying it onto itself, which raises a fresh
`ObjectCreated`:

```bash
aws s3 cp s3://open-jii-heartbeat-<env>/<key> s3://open-jii-heartbeat-<env>/<key> --metadata-directive REPLACE
```

Do this only after fixing the cause, or it fails the same way. Duplicate delivery is safe: every
heartbeat metric uses `Maximum`, so republishing the same timestamp and value is idempotent rather
than double counted.

## Closing

Record which of the three it was. The exporter and the forwarder are versioned separately, so a
shape change that nobody expected is worth a line in this file.

# dlt-heartbeat

**The heartbeat collector has stopped publishing.** `CollectorHeartbeat` is always 1 when it
arrives, so only its absence carries meaning: the export task did not run, or ran and could not
write, or wrote somewhere nothing is watching.

While this fires, every `OpenJII/Data` and `OpenJII/Usage` metric sourced from the lakehouse is
blind. AWS-native metrics are unaffected and stay trustworthy throughout, which is the fastest way
to tell a collector outage from a platform outage: if ingest and backend metrics are still
reporting, the platform is fine and only the reporting is broken.

## Work the chain in order

The collector is the `export_platform_heartbeat` task on its own job,
`Metrics-Heartbeat-Export-<ENV>`, scheduled every 30 minutes and independent of the metrics
pipeline scheduler. Each link fails differently, so check them in the order the data flows.

**1. Did the job run at all?** Open the export job's run history. A paused schedule or a deleted
job is the most common cause and the least interesting: resume it. `max_concurrent_runs = 1` means
a wedged run blocks the next one, so a single hung run can look like a stopped schedule.

**2. Did the run fail?** The job posts its own failure notification to Slack, so a run that ran and
threw should already be in the channel. Open the failed run's task output; the collectors are
guarded per table, so one missing table costs its own lines and names itself rather than failing
the run. A run that fails outright is usually the external location or the wheel.

**3. Did the task write an object?**

```bash
aws s3 ls s3://open-jii-heartbeat-<env>/heartbeat/$(date -u +%Y/%m/%d)/ | tail -5
```

Objects are written one per run under a date-partitioned key. If they are landing, the collector is
alive and the break is downstream, so go to step 4. If they are not, read the task's run output: a
permissions change on the external location is the usual cause.

**4. Did the forwarder publish them?** Objects landing but no datapoints means the S3 event
notification or the forwarder Lambda is the break:

```bash
aws logs tail /aws/lambda/<env>-metrics-forwarder --since 1h
```

The forwarder logs a `published` count per invocation and names every line it skipped. No log lines
at all means the notification is not firing; lines with `published: 0` mean it ran and rejected
everything, which is a payload-shape problem rather than a delivery one.

## Verifying the fix without waiting for a schedule

Drop a hand-written object into the prefix and watch the forwarder log. That exercises the
notification, the Lambda and the IAM condition in one step, without waiting half an hour for the
next scheduled run.

## Closing

Do not close until a datapoint has actually arrived in `OpenJII/Data`. The task succeeding is not
the same as the metric existing, and this runbook exists because those two can diverge.

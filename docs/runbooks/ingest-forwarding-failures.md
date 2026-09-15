# ingest-forwarding-failures

**IoT Core accepted a device's message and then failed to deliver it.** The broker returned success
to the device, so the device believes the measurement was taken. Rule actions are retried a limited
number of times and then dropped, which makes this the one ingest metric where data is genuinely
lost rather than delayed.

Any nonzero value alarms. There is no healthy rate of forwarding failure.

## What is failing

Each ingest channel in `asyncapi.yaml` generates one topic rule with two independent actions,
Kinesis and the S3 archive. Either can fail alone, so establish which:

```bash
aws logs filter-log-events --log-group-name AWSIotLogsV2 \
  --start-time $(( ($(date +%s) - 3600) * 1000 )) \
  --filter-pattern '{ $.eventType = "RuleExecution" && $.status = "Failure" }'
```

The `ruleName` and `reason` fields in the matched events answer both "which channel" and "which
action". If nothing matches, IoT logging may be off for the account, in which case use the per-rule
CloudWatch metrics under `AWS/IoT` with a `RuleName` dimension instead.

## Likely causes, most common first

- **The action's IAM role was changed or removed.** The rules assume `iot_kinesis_role` and
  `iot_s3_role` from `infrastructure/modules/iot-core`. A tofu apply that reshaped those roles is
  the usual trigger; the timing usually matches a recent deploy.
- **Kinesis is throttling.** Check `kinesis-write-throttling`. If that is also firing, this is a
  symptom of capacity, not of permissions, and the fix is shards.
- **The S3 archive bucket policy drifted**, so the Kinesis half succeeds and the archive half does not.
- **Rule SQL is invalid after an `asyncapi.yaml` edit.** The rules are generated from that file at
  plan time, so a malformed channel definition produces a rule that fails at execution rather than
  at apply.

## Recovering the lost window

Messages dropped by a failed rule action are not replayable from IoT Core. What survives is whatever
the other action captured: if the S3 archive succeeded while Kinesis failed, the window can be
replayed into the pipeline from the archive. Establish which action failed before telling anyone the
data is gone, because half the time it is not.

## Closing

Do not close on "the metric returned to zero". Confirm the rule is executing successfully for the
affected channel, then note here which action failed and what changed, because the IAM-shaped causes
recur on the next infrastructure change to that module.

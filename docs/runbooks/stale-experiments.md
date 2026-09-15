# stale-experiments

**Experiments that were receiving data have stopped.** `experiment_status` marks an experiment stale
when its newest processed measurement is older than the freshness threshold, and this counts them.

This is the metric closest to what a researcher actually experiences, and it is almost always a
symptom rather than a cause. Its value is telling you how wide the blast radius is.

## One or many decides everything

The count alone does not say. The roster does, and it lives in the heartbeat file rather than in
CloudWatch, because per-experiment identifiers are deliberately kept out of metrics:

```bash
aws s3 ls s3://open-jii-heartbeat-<env>/heartbeat/$(date -u +%Y/%m/%d)/ | tail -1
aws s3 cp s3://open-jii-heartbeat-<env>/heartbeat/<newest>.json - \
  | grep '"detail":"stale_experiments"'
```

The roster names the experiments and how long each has been quiet, oldest first, and reports the
true total separately from the rows shown so a truncated list still tells you the real scale. The
`openjii-triage` skill reads the same file; the digest itself does not, so the count in Slack is
the whole of what the digest knows.

**Many experiments at once** means the ingest path, not the experiments. Check
`ingest-forwarding-failures`, `ingest-lag` and `kinesis-write-throttling` in the same digest and work
whichever is firing. This metric will clear on its own.

**One or a few** means those devices. Field hardware goes quiet for ordinary reasons: battery,
connectivity, someone unplugged it between campaigns. Confirm the device is expected to be running
before treating it as a fault.

## The cause that looks like neither

A device whose credentials were rotated but whose configuration was not redelivered connects fine
and publishes to a topic nothing reads. It appears here as a single stale experiment with a
perfectly healthy device, and it will not recover on its own. If a device is reachable and thinks it
is publishing while its experiment is stale, check that its topic prefix matches what the experiment
expects.

## Closing

Freshness is recomputed only when the centrum pipeline runs, so the count does not fall the moment
data resumes. Confirm the affected experiments are receiving measurements again rather than waiting
for the number to move.

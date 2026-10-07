# experiment-latency

**New measurements are taking longer than usual to reach the experiment tables.** Every half hour
the heartbeat export takes the rows committed to `experiment_raw_data` and measures, for the
slowest twentieth, how long each took from silver processing it to its commit there. Researchers
see their data that much later. Nothing is lost.

The limit is 60 seconds in prod, where an ordinary half hour sits near 16 s, and 120 in dev, whose
p95 reaches a minute on ordinary days. It fires on two slow half hours in a row. During the
September heap leak, prod's passed 150 s before the driver stalled.

## First, the driver

Check `driver-heap` in the same alert list. A driver that keeps most of its memory spends its time
collecting garbage, and every flow in the pipeline slows with it. If that alert is firing, or the
daily report's "Pipeline driver memory kept" chart for `centrum` sits high, follow
[driver-heap](driver-heap.md): a restart is the fix and this alert clears after it.

## Then the pipeline's compute

Open `Centrum-DLT-Pipeline-<ENV>` in the Databricks workspace and read its event log over the
slow period.

- **Workers lost.** Spot workers are reclaimed now and then, and the flows run short of cores
  until replacements start. The event log shows the cluster resizing. Latency recovers by itself
  once the cluster is back to size.
- **An update restarted.** The first batches after a restart carry everything that waited, so they
  take longer. It should clear within the next half hour or two.
- **One flow is slow.** The flow progress events show each flow's batch durations. A flow that
  takes far longer than its neighbours holds back what reads from it.

## When nothing above explains it

If latency stays high with a healthy driver and a full cluster, the pipeline needs more compute
than it has, or a change made a flow more expensive. Compare the slow flow's batch durations with a
week earlier, and read [Pipeline compute](../../apps/docs/content/developers/architecture/pipeline-compute.mdx)
before resizing anything.

## Closing

Close once two half hours in a row are back under the limit on the daily report.

# flow-restarts

**A flow that streamed measurements wait on started more than two runs in an hour.** A flow that fails
is retried, so data can keep moving and nothing looks broken from outside. Each retry replays work,
though, and a flow that fails on every batch never gets through. A gold pipeline once failed about 760
times in eight days, four an hour, with no one told.

The heartbeat export reads each pipeline driver's log every half hour. An hour reaches the log volume
about an hour after it closes, so the reading is two to three hours old. The alert's `Pipeline` and
`Flow` labels name the pipeline and the table its flow writes, as in [flow-busy](flow-busy.md). A
planned restart of the pipeline starts every flow once, and the alert waits for more than two, so a
restart and a retry stay quiet. A pipeline that keeps failing on new clusters shows in [pipeline-cluster-starts](pipeline-cluster-starts.md)
instead, since a cluster that stops within the hour leaves no hourly log.

## Confirm it

In the Databricks workspace, open the pipeline and its update's event list, and filter for errors.
A flow that is retried logs the exception that stopped it each time. The same error over and over is
a flow failing on the data. Different errors across flows point at the cluster, such as a driver
short of memory ([driver-heap](driver-heap.md)).

The driver's log shows the same thing without the workspace. In
`/Volumes/<catalog>/centrum/pipeline-logs/<pipeline>/<cluster id>/driver/log4j-<YYYY-MM-DD-HH>.log.gz`,
each run of a flow begins with a line the heartbeat counts, even for a run that fails before its first
batch:

```text
MicroBatchExecution: Starting __materialization_mat_clean_data_1 [id = e6fe32b4-..., runId = 73b3bd21-...]
```

## Act

- **A flow failing on the data:** find the rows in the error, then fix the code that cannot read them,
  or keep them out with an expectation in the stage before. Deploy, and the flow resumes from its
  checkpoint.
- **The cluster:** a driver short of memory needs [driver-heap](driver-heap.md). For anything else,
  the pipeline's cluster events in the workspace say why each cluster ended.

## Closing

Close once the flow has gone a day without more than two starts in an hour. Note the error here, so
the next occurrence starts from it.

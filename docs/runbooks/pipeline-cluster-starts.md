# pipeline-cluster-starts

**A pipeline started more than two clusters in an hour.** A planned restart starts one, so more usually
means its updates keep failing and starting again. While it does, its flows run little or not at all,
and measurements wait in Kinesis. Nothing is lost while the stream keeps them, 24 hours
on dev and 72 on prod.

The heartbeat export counts the cluster folders created in the last closed hour under
`/Volumes/<catalog>/centrum/pipeline-logs/<pipeline>/`, whose names start with the time they were
created: `1030-173330-96v7f5e4` was created at 17:33:30 UTC on 30 October. It reads within half an
hour of the hour closing. The alert's `Pipeline` label names the pipeline: `centrum` for
`Centrum-DLT-Pipeline-<ENV>`, `macro` for `Macro-Execution-DLT-Pipeline-<ENV>`.

## Confirm it

In the Databricks workspace, open the pipeline and read its recent updates. Each failed update names
the error that ended it. A cluster that could not start at all, with no update error, is usually
capacity rather than code.

A cluster that stops within an hour leaves only `driver/log4j-active.log` in its folder, never an
hourly file, so read that file for the error when the workspace no longer shows the update.

## Act

- **The same error every update:** fix what it names and deploy. A flow failing on the data is
  covered in [flow-restarts](flow-restarts.md); a driver short of memory in
  [driver-heap](driver-heap.md).
- **Clusters that cannot start:** retry later, or move the pipeline's workers to another instance
  type in its OpenTofu definition.

## Closing

Close once the pipeline has run on one cluster for an hour. Note the error here, so the next
occurrence starts from it.

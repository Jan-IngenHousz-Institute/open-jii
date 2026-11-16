# exports-failed

**An export failed on our side.** A researcher asked for a copy of an experiment's data and got a
failure that was not about their data or request. The backend follows each export's Databricks job
run and records a failure with an error code (`apps/backend/src/experiments/application/services/export-run-reconciler.service.ts`).
`no_data` and `too_many_rows_for_format` are the data's and are not counted. `unknown` is ours and is
counted once, by the backend task that finished the export. The status page shows Exports degraded
for an hour after one.

## See which exports

Run this in the RDS query editor for the environment:

```sql
SELECT id, experiment_id, table_name, format, job_run_id, created_at, completed_at
FROM experiment_exports
WHERE status = 'failed' AND error_code = 'unknown' AND completed_at > now() - interval '2 hours'
ORDER BY completed_at DESC;
```

## Likely causes, most common first

- **The job run failed without saying why.** The export job raises `EXPORT_ERROR[<code>]` for the
  data's own problems, so a failure without it is a crash: the cluster, a permission or a bug. Open
  the run by its `job_run_id` in Databricks and read the last attempt's error.
- **The run never started.** The backend tries to start a run for a quarter of an hour, then gives
  up. `dependency-health` usually fires as well when Databricks could not be reached.
- **The run took two days.** An export still in flight after two days is failed. Look for a stuck
  run in Databricks.
- **The manifest was missing or unreadable.** The run succeeded but its manifest in the exports
  bucket could not be used. Check the object under the export's id.

## Closing

Say in the alert's Slack thread which cause it was and whether the researcher needs to ask again.
An export that failed stays failed. The researcher starts a new one.

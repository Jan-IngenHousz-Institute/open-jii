# macro-backlog

**Rows that need macros have waited over an hour without any result.** Researchers see those
measurements without their computed values. A failed macro still writes a result row with its
error, so a backlog means results are not being produced at all, not that macros are failing.

The chain is the `Macro-Execution-DLT-Pipeline-<ENV>` pipeline, which posts batches to the backend,
which runs them in the macro sandboxes (Python, JavaScript, R). The heartbeat export counts the
backlog every half hour.

## Where it stops

- **The macro pipeline is not running.** In the Databricks workspace, open
  `Macro-Execution-DLT-Pipeline-<ENV>` and read its latest update. "Since last macro" on the daily
  report says how long since it last wrote.
- **The backend or the sandboxes are refusing.** Check the same alert list for `backend-5xx`,
  `sandbox-errors`, `sandbox-throttles` and `sandbox-blocked-connections`. The pipeline retries a
  failed batch, then fails its update.
- **One row can never get a result.** The count has no lower time bound, so a row whose result was
  deleted keeps it above zero on its own. List what is waiting:

```sql
SELECT r.experiment_id, r.id, r.processed_timestamp
FROM <catalog>.centrum.experiment_raw_data r
WHERE r.processed_timestamp < current_timestamp() - INTERVAL 15 MINUTES
  AND size(r.macros) > 0
  AND NOT coalesce(r.skip_macro_processing, false)
  AND NOT EXISTS (
    SELECT 1 FROM <catalog>.centrum.experiment_macro_data m WHERE m.raw_id = r.id
  )
ORDER BY r.processed_timestamp
LIMIT 50
```

Rows spread across many experiments and still growing mean the pipeline or the sandboxes. A fixed
handful of old rows means orphans, which need a data repair rather than a restart.

## Closing

Do not close until the backlog on the daily report reads zero at an export.

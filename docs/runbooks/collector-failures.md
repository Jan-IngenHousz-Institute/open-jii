# collector-failures

**One or more of the heartbeat export's collectors raised on its latest run.** Each collector runs
on its own, so a failing one costs only its own series, which read No data on the reports, while
the others keep reporting and `CollectorHeartbeat` stays healthy. This count is what tells that No
data apart from a table that was simply quiet.

## Which collector, and why

Every run's heartbeat file carries a `failed_collectors` line naming each collector that raised,
with the opening of its error:

```bash
prefix=s3://open-jii-heartbeat-<env>/heartbeat/$(date -u +%Y/%m/%d)/
aws s3 cp "$prefix$(aws s3 ls "$prefix" | tail -1 | awk '{print $4}')" - | grep failed_collectors
```

The full error is in the run's task output on the `Metrics-Heartbeat-Export-<ENV>` job. The
collectors, and what goes quiet when one fails:

| Collector           | Series                                  |
| ------------------- | --------------------------------------- |
| `experiment_status` | Gold tables age, stale experiments      |
| `metrics_tables`    | Public metrics age, the usage counts    |
| `device_silence`    | Silent devices                          |
| `ingest_quality`    | Malformed payloads                      |
| `ingest`            | Ingested rows and their latency         |
| `experiment_rows`   | Rows into experiments and their latency |
| `broker_to_api`     | Broker to API                           |
| `macro_results`     | Macro results and their latency         |
| `macro_backlog`     | Macro backlog                           |
| `path_idle`         | Since last ingest, since last macro     |

## Likely causes, most common first

- **A column or table the query reads is not there yet.** A pipeline change that adds a column
  reaches the table on the pipeline's next update, and the export can run first. It passes once
  the update lands.
- **The table history does not reach the half hour.** The data-path collectors turn the half hour
  into commit versions from the last 1,000 entries of the table's history, about ninety minutes in
  prod, and refuse to undercount when that falls short. A pipeline committing faster needs
  `HISTORY_DEPTH` raised in `apps/data/src/tasks/metrics_heartbeat_task.py`.
- **A transient read failure.** One run failing and the next passing needs nothing.
- **A permission change** on a table or schema the export reads.

## Closing

Do not close until a run reports zero failures.

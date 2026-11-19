# store-metrics-age

**For ten minutes, one of the serving store's platform metrics views had gone more than two hours
without a refresh.** The views (`store.metrics_*`, from ClickHouse migration 0011) recount the
platform metrics every hour, at seven minutes past, one after another in a fixed chain. A view whose
refresh fails keeps its last figures, so the public metrics go stale without an error, and every view
after it in the chain waits until it succeeds. A timer on the store's instance reads the views'
state once a minute and sends the age of the stalest, `MetricsRefreshAgeMinutes`, and how many failed
their last refresh, `MetricsRefreshFailures`. A view that has not refreshed since the store started
counts its age from the start.

## Find the view and its error

Connect as the admin, as `store-memory` describes, and read the chain's state:

```sql
SELECT view, status, last_success_time, last_success_duration_ms, retry, exception
FROM system.view_refreshes
WHERE database = 'store' AND startsWith(view, 'metrics_')
ORDER BY last_success_time;
```

The first view with an exception is the cause. The ones after it show `WaitingForDependencies`.

## Likely causes, most common first

- **Code 241, the memory cap.** A refresh runs under its definer's 4 GiB per query. The views that
  hold the most come last in the chain, and `metrics_parameter_stats`, which reads every reading of
  90 days into a median sketch of fixed size per parameter, is the one that grows with the data.
  Find what it read:

  ```sql
  SELECT event_time, query_duration_ms, formatReadableSize(memory_usage) AS memory, read_rows
  FROM system.query_log
  WHERE user = '' AND query_kind = 'Insert' AND has(tables, 'store.metrics_parameter_stats')
  ORDER BY event_time DESC
  LIMIT 5;
  ```

  The fix is a change to the view in a new migration, not a higher cap.

- **The store restarted** and the chain has not run since. It runs at the next seven minutes past
  the hour. To run it now, refresh the views in chain order, waiting for each:
  `SYSTEM REFRESH VIEW store.<view>` then `SYSTEM WAIT VIEW store.<view>`.
- **The store busy or out of memory,** as `store-memory` covers, when other store alerts fire too.

## Medians against the pipeline's

A change to `metrics_parameter_stats` keeps its median within these bounds of the pipeline's. Up to
5,000 readings of a parameter, both are its lower middle value, so they are equal. Past that, each
side's Greenwald-Khanna sketch at accuracy 10,000 picks a value within n/10,000 ranks of it for n
readings, rounded up, and each splits the readings its own way, so the two may differ by twice that.
The store ranks every NaN reading above every number. Spark does so within a partition, but compares
with `<` when it merges partitions, which can rank a NaN among the numbers.

## Closing

Name the view, its error and the change that fixed it, or the restart that explains the gap.

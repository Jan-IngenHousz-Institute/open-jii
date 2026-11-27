# store-metrics-age

**For ten minutes, one of the serving store's platform metrics views had gone more than two hours
without a refresh, or one was missing, had failed its last refresh or had none since the store
started.** The views (`store.metrics_*`, from ClickHouse migration 0010) recount the platform metrics
every hour, at seven minutes past, one after another in a fixed chain. A view whose refresh fails
keeps its last figures, so the public metrics go stale without an error, and every view after it in
the chain waits until it succeeds. A timer on the store's instance reads the views' state once a
minute and sends the age of the stalest, `MetricsRefreshAgeMinutes`, and how many are missing, failed
their last refresh, or have none since the store started and are not refreshing or waiting to,
`MetricsRefreshFailures`, and each has its own rule. A view that has not refreshed since the store
started counts its age from the start, so after a failed refresh at start its age reads low while its
figures are older, which the second count catches. The timer sends both once the migration ledger,
`store._migrations`, holds 0010.

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

- **The store restarted** and the refresh each view runs when the server starts failed, as when it
  came up short of memory. The view keeps its figures from before, with no `last_success_time` and
  the exception. To run the chain now, refresh the views in chain order, waiting for each:
  `SYSTEM REFRESH VIEW store.<view>` then `SYSTEM WAIT VIEW store.<view>`.
- **A view is missing.** A view in `metrics_views` in `infrastructure/modules/serving-store/main.tf`
  that the query above does not list was dropped or never made. Apply migration 0010's statement for
  it again as the admin.
- **The timer cannot read the views' state,** which counts every view as failing and logs
  `the view refreshes did not answer` in the timer's journal (`journalctl -u openjii-feed-metrics`).
  The timer reads as `openjii_monitor`, which `users.xml` grants `SELECT ON system.view_refreshes`.
- **The store busy or out of memory,** as `store-memory` covers, when other store alerts fire too.

## A chain that runs past the hour

`DEPENDS ON` orders the views within one hour's cycle, but the next cycle's first view starts at
seven past regardless, while the cycle before may still be refreshing its later views. Left alone, a
chain that spans several hours refreshes that many views at once, up to all eleven: on ClickHouse
25.8, a chain made to run past its period ran four at once. So every view's refresh runs in the
workload `metrics_refreshes`, which admits one query at a time. A refresh waiting for its turn has
not started, so it holds no memory.

Refreshes run as no user, so the reader profile's 6 GiB for all of the reader's reads together does
not cover them. One refresh at its definer's 4 GiB beside the reader's 6 GiB comes to 10 GiB. Both
environments run the store on an r7g.large, 16 GiB, of which ClickHouse takes up to 80%, about
12.8 GiB, which leaves about 2.8 GiB for the feed's inserts and merges.

A chain that runs past the hour shows in the chain's state above as `last_success_duration_ms`
adding up to more than an hour, and as several views `Running`, since a view waiting for its turn
shows as `Running` too. Only the one refreshing is in `system.processes`:

```sql
SELECT query_id, elapsed, formatReadableSize(memory_usage) AS memory
FROM system.processes
WHERE user = '' AND query_kind = 'Insert';
```

The workload belongs to the server rather than to the `store` database, and without it the views
refresh side by side without an error. If
`SELECT create_query FROM system.workloads WHERE name = 'metrics_refreshes'` returns nothing, run
migration 0010's `CREATE RESOURCE` and `CREATE WORKLOAD` statements again as the admin.

A chain that overran once and caught up needs nothing. One that overruns every hour needs its
slowest views, by that column, made cheaper in a new migration, as for the memory cap.

## Medians against the pipeline's

A change to `metrics_parameter_stats` keeps its median within these bounds of the pipeline's. Up to
5,000 readings of a parameter, both are its lower middle value, so they are equal. Past that, each
side's Greenwald-Khanna sketch at accuracy 10,000 picks a value within n/10,000 ranks of it for n
readings, rounded up, and each splits the readings its own way, so the two may differ by twice that.
The store ranks every NaN reading above every number. Spark does so within a partition, but compares
with `<` when it merges partitions, which can rank a NaN among the numbers.

## Closing

Name the view, its error and the change that fixed it, or the restart that explains the gap.

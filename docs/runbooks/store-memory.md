# store-memory

**The serving store's instance is above 85% memory.** ClickHouse caps its own memory at 90% of the
machine's by default (`max_server_memory_usage_to_ram_ratio`). Past the cap it fails a query with
`MEMORY_LIMIT_EXCEEDED` (code 241) instead of letting the kernel kill the server, and the query it
fails is the one using the most memory beyond its share, not always the one that crossed the cap.

## Find what holds the memory

Connect from a session on the instance (`aws ssm start-session --target <instance-id>`) with
`clickhouse-client --user openjii_admin --password`. The instance cannot read secrets, so take the
password from your own machine:

```bash
aws secretsmanager get-secret-value --secret-id openjii-serving-store-<env>-admin \
  --query SecretString --output text | jq -r .password
```

Whether the memory is ClickHouse's at all:

```sql
SELECT metric, formatReadableSize(value) FROM system.asynchronous_metrics
WHERE metric = 'MemoryResident' OR metric LIKE '%CacheBytes'
ORDER BY value DESC;
```

What is running, and what merges are doing:

```sql
SELECT query_id, user, elapsed, formatReadableSize(memory_usage) AS memory, query
FROM system.processes ORDER BY memory_usage DESC LIMIT 10;

SELECT database, table, elapsed, formatReadableSize(memory_usage) AS memory
FROM system.merges ORDER BY memory_usage DESC;
```

What ran in the last hour, including the queries the cap failed:

```sql
SELECT event_time, type, exception_code, user, formatReadableSize(memory_usage) AS memory, query
FROM system.query_log
WHERE type != 'QueryStart' AND event_time > now() - INTERVAL 1 HOUR
ORDER BY memory_usage DESC
LIMIT 10;
```

## Likely causes, most common first

- **A join with a large right-hand side.** The default hash join builds a table of the right side
  in memory. Put the smaller side on the right, or when both are large, run the query with
  `SETTINGS join_algorithm = 'grace_hash'`.
- **Large inserts or merges,** when `system.merges` or the pipelines' inserts lead the list. They
  pass when the batch or the merge finishes.
- **The data outgrew the instance,** when nothing stands out and memory follows the data. Raise
  `instance_type` in the store's inputs in `infrastructure/env/<env>/main.tf`. AWS stops and starts
  the same instance with its data volume, and `store-answers` fires while it is down.

## Closing

Name the query, merge or insert, or note that the data outgrew the instance.

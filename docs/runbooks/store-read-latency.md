# store-read-latency

**For ten minutes, the slowest twentieth of the backend's reads of the serving store took over a
second.** A timer on the store's instance measures it once a minute, from the query log, over the
reads the backend's user (`openjii_reader`) made in the last five minutes. That user may not use
more than 4 GiB or 30 seconds on one query, so a read past either fails instead and counts in
`StoreReadFailures`.

## Find the slow reads

The timer's own user sees only the reads' timings. Their text needs the admin: connect as
`store-memory` describes, then group the last hour's reads by their shape:

```sql
SELECT normalized_query_hash, count() AS reads, round(quantile(0.95)(query_duration_ms)) AS p95_ms,
  formatReadableSize(max(memory_usage)) AS memory, any(query) AS example
FROM system.query_log
WHERE user = 'openjii_reader' AND type = 'QueryFinish' AND event_time > now() - INTERVAL 1 HOUR
GROUP BY normalized_query_hash
ORDER BY p95_ms DESC
LIMIT 10;
```

The example names an experiment and, for a sort by a name, the ids in that order. The backend never
sends names to the store, so its log holds none.

## Likely causes, most common first

- **A page sorted by a contributor's or a device's name on a large experiment.** The store ranks
  every row of the experiment; measured locally, that took about a second for 20 million rows.
- **A filter or sort on a payload field,** which reads the JSON column of every row in the
  experiment.
- **The store busy with something else,** such as a reload or large merges (`system.merges`), when
  every shape is slow at once. `store-memory` covers memory.
- **The data outgrew the instance,** when nothing stands out and reads slow down as the data grows.
  `store-memory` says how to raise the instance type.

## Closing

Name the read shape and its cause, or note that the data outgrew the instance.

# store-read-latency

**For ten minutes, the slowest twentieth of the backend's reads of the serving store took over a
second, or failed.** A timer on the store's instance measures it once a minute, from the query log,
over the reads the backend's user (`openjii_reader`) made in the last five minutes. That user may not
use more than 4 GiB or 30 seconds on one query, or 6 GiB across its queries, so a read past any of
them fails instead. A failed read counts as 30 seconds, so failures alone can fire this, and
`StoreReadFailures` says how many there were.

If they are failures, the query log names them:

```sql
SELECT exception_code, count() AS reads, any(exception) AS example
FROM system.query_log
WHERE user = 'openjii_reader' AND type != 'QueryFinish' AND type != 'QueryStart'
  AND event_time > now() - INTERVAL 1 HOUR
GROUP BY exception_code
ORDER BY reads DESC;
```

Code 159 is the 30-second limit and 241 a memory cap; both point at a slow read shape below.

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

The store masks every string value in its logs, so the example shows the read's shape with `'***'`
for the experiment and the values it filters or sorts by. The backend logs which experiment and
table each page read was for. In CloudWatch Logs Insights, on `/aws/ecs/backend-service-<env>`:

```text
fields @timestamp, experimentId, tableName, mode, totalMs
| filter msg = "Experiment data read" and source = "store"
| sort totalMs desc
| limit 20
```

A device page reads through the `device_*` views instead (`device_measurements`,
`device_experiment_ids`, `device_newest_measurements`, `device_lifecycle_events`,
`device_last_activity` and `device_events_reloaded`), so its shapes name those, with the device
masked. The backend logs each device page request with its device:

```text
fields @timestamp, operation, deviceId
| filter source = "store" and ispresent(deviceId)
| sort @timestamp desc
| limit 20
```

## Likely causes, most common first

- **A page sorted by a contributor's or a device's name on a large experiment.** The store ranks
  every row of the experiment; measured locally, that took about a second for 20 million rows.
- **A filter or sort on a payload field,** which reads the JSON column of every row in the
  experiment.
- **A device page for a device with many rows in its window.** Its measurement reads
  (`device_measurements`, `device_newest_measurements`, `device_last_activity` and
  `device_experiment_ids`) take the device's rows from `measurements_by_device` alone, where the
  writer marks a copy that another client's copy replaced once its chunk lands, and the newest rows
  then read their payloads from `measurements` by key. Its sessions read `device_lifecycle_events`,
  which reads `device_events` alone. Measured locally at 2 threads over a month, a read took 13 to
  19 ms for a device with 100,000 rows spread through an experiment of 6 million, and 6 to 22 ms for
  1,000 rows spread through 24.6 million.
- **The store busy with something else,** such as a reload or large merges (`system.merges`), when
  every shape is slow at once. `store-memory` covers memory.
- **The data outgrew the instance,** when nothing stands out and reads slow down as the data grows.
  `store-memory` says how to raise the instance type.

## Closing

Name the read shape and its cause, or note that the data outgrew the instance.

# database-cpu

**The Aurora writer is above 80% CPU.** The cluster is a single Serverless v2 instance capped at
1 ACU in both environments, so it cannot scale past what it has. At 80% it is close to its
ceiling, and past it queries wait for each other.

## Find the query

Performance Insights is enabled on the instance. Its top SQL by load answers "which query" without
a database session. With a session, `pg_stat_statements` gives the same answer:

```sql
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

## Likely causes, most common first

- **One expensive query**, usually new with a recent deploy: a missing index or an unbounded read.
  Every backend task holds a single database connection, so while that query runs, every other
  request on the task waits behind it. That is why the whole API slows down with it
  (`backend-5xx`).
- **Load past 1 ACU.** When no single query dominates and CPU follows traffic, the cluster needs a
  higher maximum capacity (`max_capacity` in the Aurora inputs in
  `infrastructure/env/<env>/main.tf`). It costs more only while the capacity is used.

The cluster also pauses after 30 idle minutes. The first connection after a pause waits 15 to 30
seconds for it to resume, and the resumed cluster then runs CPU above 100% for a few minutes on its
small starting capacity. On dev on 9 October, all five spells above 80% came within ten minutes of a
wake-up. The rule's five-minute hold keeps these at Pending, so a Pending flap right after
`ServerlessDatabaseCapacity` left 0 is a wake-up, not load.

## Closing

Name the query, and what changed it, or note that load outgrew the cap.

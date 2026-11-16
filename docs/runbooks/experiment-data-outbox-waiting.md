# experiment-data-outbox-waiting

**A copy of an annotation or metadata sheet has waited in the outbox for over 30 minutes.** Postgres
holds annotations and metadata sheets, and every change to one owes its current state to each copy
the environment keeps: the lakehouse, which exports, charts and the warehouse views read, and the
serving store, where the environment has its copier. Each owed copy is a row in
`experiment_data_outbox`, and the worker on every backend task applies them. Every five minutes each
task publishes `ExperimentDataCopiesWaiting`, how many rows are owed, and
`ExperimentDataCopyOldestWaitingSeconds`, how long since the oldest was first owed (its `created_at`,
on the database's clock). The rule fires when the age stays above 1,800 seconds for 5 minutes. A
copy usually lands within seconds.

Pages read annotations and sheets from Postgres, so nobody sees a stale page. What waits is the
copy: an export, a chart or a store filter may be missing the latest edits.

## Which copy, and why

List what is owed, oldest first, from a database session:

```sql
select destination, record_type, attempts, next_attempt_at, claimed_at, last_error, created_at
from experiment_data_outbox
order by created_at
limit 50;
```

- **Every row of one destination waits with the same error:** that copy is unreachable.
  - `lakehouse`: the SQL warehouse is refusing statements or the backend's Databricks token is
    wrong. A cold warehouse is not it: the first retries outlast a cold start.
  - `serving_store`: the store is down (`store-answers`), or its copier's login is wrong. The copier
    is `openjii_copier`; its secret is the store module's `copier` credentials.
- **One row climbs while the rest land:** that record fails on every attempt; `last_error` says
  why. A sheet the warehouse refuses, for example, keeps failing until it is edited.

The worker logs each failure, and from the fifth attempt on as an error:

```bash
aws logs tail /aws/ecs/backend-service-<env> --since 2h --filter-pattern '{ $.msg = "Could not copy experiment data; will retry" }'
```

## After the fix

Nothing is lost while a copy waits: a row is never dropped, and each retry copies the record's
state at that moment. The retries wait 10 seconds, 1, 5 and 15 minutes, then an hour each time, so
once the cause is fixed the rows land at their next attempt. To land them now, make them due:

```sql
update experiment_data_outbox
set next_attempt_at = (now() at time zone 'utc')
where claimed_at is null and destination = '<destination>';
```

Do not delete rows: a deleted row is a copy nobody owes again until the record changes.

## Closing

Do not close until the age has read 0 for 15 minutes.

# experiment-data-outbox-waiting

**A copy of an annotation, metadata sheet, contributor or device has waited in the outbox for over
30 minutes.** Postgres holds annotations and metadata sheets, and every change to one owes its
current state to the lakehouse's copy, which exports, charts and the warehouse views read. The
serving store's sheet rows come from that copy through the store feed. A change to a profile or a
device owes the lakehouse its copy too, in `centrum.contributor_profiles` or
`centrum.device_registry`, which the pipelines join to name an experiment's contributors and
devices. Each owed copy is a row in `experiment_data_outbox`, and the worker on every backend task
applies them. Every five minutes each task publishes `ExperimentDataCopiesWaiting`, how many rows are
owed, and `ExperimentDataCopyOldestWaitingSeconds`, how long since the oldest was first owed (its
`created_at`, on the database's clock). The rule fires when the age stays above 1,800 seconds for 5
minutes. A copy usually lands within seconds.

Pages read annotations from Postgres, so nobody sees a stale annotation, and store pages read names
and devices from Postgres too. What waits is the copy: an export, a chart, or the custom metadata a
page shows, through the warehouse or the store, may be missing the latest edits, and the warehouse
views, with the pages still read through them, keep a contributor's or device's previous name and
status.

## Which copy, and why

List what is owed, oldest first, from a database session:

```sql
select destination, record_type, attempts, next_attempt_at, claimed_at, last_error, created_at
from experiment_data_outbox
order by created_at
limit 50;
```

- **Every row waits with the same error:** the lakehouse is unreachable. The SQL warehouse is
  refusing statements or the backend's Databricks token is wrong. A cold warehouse is not it: the
  first retries outlast a cold start.
- **One row climbs while the rest land:** that record fails on every attempt; `last_error` says
  why. A sheet the warehouse refuses, for example, keeps failing until it is edited.

The worker logs each failure, and from the fifth attempt on as an error:

```bash
aws logs tail /aws/ecs/backend-service-<env> --since 2h --filter-pattern '{ $.msg = "Could not copy experiment data to the lakehouse; will retry" }'
```

## After the fix

Nothing is lost while a copy waits: a row is never dropped, and each retry copies the record's
state at that moment. The retries wait 10 seconds, 1, 5 and 15 minutes, then an hour each time, so
once the cause is fixed the rows land at their next attempt. To land them now, make them due:

```sql
update experiment_data_outbox
set next_attempt_at = (now() at time zone 'utc')
where claimed_at is null;
```

Do not delete rows: a deleted row is a copy nobody owes again until the record changes.

## No data at all

Every task publishes the age every five minutes, 0 when nothing waits, so an empty chart means the
job that reports the outbox stopped, not that the copies did. The rule then fires about 20 minutes
after the last point: the query looks back 15 minutes, then the rule holds for 5 more. Either the
backend is not running, and `api-hosts-unhealthy` or `dependency-health` fires alongside, or it runs
but cannot count the outbox or publish what it counted:

```bash
aws logs tail /aws/ecs/backend-service-<env> --since 1h --filter-pattern '{ $.operation = "experiment-data-outbox-metrics" }'
```

A failed count points at the database; a publish refused for permissions points at the task role's
`OpenJII/Backend` policy in `infrastructure/modules/ecs/main.tf`. The copies may still be landing
meanwhile: the outbox rows above say whether they are.

## Closing

Do not close until the age has read 0 for 15 minutes, which after no data also means the
reporting is back.

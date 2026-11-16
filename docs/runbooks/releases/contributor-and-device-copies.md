# contributor-and-device-copies

**Owes the lakehouse a copy of every existing profile and device once, so the pipelines can name an
experiment's contributors and devices without calling the backend.** From this release on, the gold
tables `experiment_contributors` and `experiment_devices` join two lakehouse tables,
`centrum.contributor_profiles` and `centrum.device_registry`, instead of asking the backend for
names (OJD-1924). The backend keeps both tables to Postgres through `experiment_data_outbox`: every
profile edit, deactivation, reactivation and account closing owes its contributor's copy, and every
device registration, status change and deletion owes its device's copy. The profiles and devices
already in Postgres are owed nothing, so until this step has run the two gold tables name nobody.

This runs by hand once per environment. It is a copy done once, so nothing in the repository runs
it.

## 1. Owe every profile and device

The release deploys infrastructure first, which creates the two tables, then applies the database
migration, which adds the `contributor` and `device` record types, then the backend, then the
Databricks bundle. Run this from a database session as soon as the migration has applied:

```sql
INSERT INTO experiment_data_outbox (record_type, record_id, destination)
SELECT 'contributor', user_id, 'lakehouse' FROM profiles
UNION ALL
SELECT 'device', id, 'lakehouse' FROM iot_devices
ON CONFLICT (record_type, record_id, destination) WHERE claimed_at IS NULL DO NOTHING;
```

A task of the previous release claims only annotations and sheets, so the rows wait for the new
tasks, which copy them as they start. The rows carry no experiment: a profile or a device belongs to
none. A profile or device written meanwhile is already owed, and the conflict clause leaves its row
alone; owing a copy twice does no harm, since a copy writes each record's state at the time of the
copy.

If the bundle lands before the copies, the enriched views show no contributor name and an empty
device for the minutes the copies take. Where the Databricks deploy waits for an approval of its
own, give it once step 2 reads 0.

## 2. Wait until no copy is owed

```sql
SELECT record_type, count(*), max(attempts), max(last_error)
FROM experiment_data_outbox WHERE record_type IN ('contributor', 'device')
GROUP BY record_type;
```

It reads no rows once every copy landed. Each task copies 200 rows a statement, one claim after
another, so a few thousand profiles should take minutes. A row whose attempts keep climbing names the
lakehouse's refusal in `last_error`; [experiment-data-outbox-waiting](../experiment-data-outbox-waiting.md)
covers why, and fires if one waits over 30 minutes.

## 3. Check, once

Count both sides. In psql:

```sql
SELECT (SELECT count(*) FROM profiles) AS profiles, (SELECT count(*) FROM iot_devices) AS devices;
```

In the environment's Databricks SQL editor:

```sql
USE CATALOG open_jii_<env>;

SELECT (SELECT count(*) FROM centrum.contributor_profiles) AS profiles,
       (SELECT count(*) FROM centrum.device_registry) AS devices;
```

The two agree. A write between the two queries can leave one off by its own record; step 2 then
shows the copy owed, and the counts agree once it lands. Any other difference is a copy that has
not landed: owe the missing ones again by id, as step 1 does with `AND user_id IN (...)` or
`AND id IN (...)`.

The same insert repairs either table if it is ever emptied.

## Rolling back

The previous release's gold tables call the backend again, and its backend serves them. Its tasks
never claim a `contributor` or `device` row, so any left owed would wait and fire
`experiment-data-outbox-waiting`. Once the rollback is out, delete them:

```sql
DELETE FROM experiment_data_outbox WHERE record_type IN ('contributor', 'device');
```

When the release comes back, run step 1 again: the copies missed every change made meanwhile.

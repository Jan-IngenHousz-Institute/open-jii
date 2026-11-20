# contributor-and-device-copies

**Owes the lakehouse a copy of every existing profile and device once, then switches Centrum to
naming an experiment's contributors and devices from those copies instead of calling the backend.**
From this release on, the gold tables `experiment_contributors` and `experiment_devices` join two
lakehouse tables, `centrum.contributor_profiles` and `centrum.device_registry` (OJD-1924). The
backend keeps both tables to Postgres through `experiment_data_outbox`: every profile edit,
deactivation, reactivation and account closing owes its contributor's copy, and every device
registration, status change and deletion owes its device's copy. The profiles and devices already
in Postgres are owed nothing until step 2 runs.

The enriched views name an annotation's author from `centrum.contributor_profiles` too, as soon as
the release redefines them, so they read names from it once it is filled. Until step 3 drains, an
annotation added on the platform shows no author's name in the views or in an export.

The bundle deploy does not switch the code. Centrum runs continuously and keeps running the
notebooks it started with until it restarts, so after the release it still asks the backend for
names. This release keeps the two routes it asks, `POST /api/v1/users/metadata` and
`POST /api/v1/iot/devices/registry`, so names stay in place throughout. Step 5's restart is the
switch, and it waits until the copies have landed.

This runs by hand once per environment. It is a copy done once, so nothing in the repository runs
it.

## 1. Wait for the backend rollout to finish

The release deploys infrastructure first, which creates the two tables, then applies the database
migration, which adds the `contributor` and `device` record types, then the backend, then the
Databricks bundle. Wait until every backend task runs the new release: the ECS service shows one
deployment, and none of the old task definition. A task of the previous release owes nothing when a
profile or device changes, so a write it takes after step 2 would never reach the copy. Waiting
loses nothing, since no task of the previous release copies these records anyway.

## 2. Owe every profile and device

From a database session:

```sql
INSERT INTO experiment_data_outbox (record_type, record_id, destination)
SELECT 'contributor'::experiment_data_record_type, user_id,
       'lakehouse'::experiment_data_destination
FROM profiles
UNION ALL
SELECT 'device', id, 'lakehouse' FROM iot_devices
ON CONFLICT (record_type, record_id, destination) WHERE claimed_at IS NULL DO NOTHING;
```

The rows carry no experiment: a profile or a device belongs to none. A profile or device written
since step 1 is already owed, and the conflict clause leaves its row alone. Running the insert
twice does no harm, since a copy writes each record's state at the time of the copy.

## 3. Wait until no copy is owed

```sql
SELECT record_type, count(*), max(attempts), max(last_error)
FROM experiment_data_outbox WHERE record_type IN ('contributor', 'device')
GROUP BY record_type;
```

It reads no rows once every copy landed. Each task copies 200 rows a statement, one claim after
another, so a few thousand profiles should take minutes. A row whose attempts keep climbing names
the lakehouse's refusal in `last_error`;
[experiment-data-outbox-waiting](../experiment-data-outbox-waiting.md) covers why, and fires if one
waits over 30 minutes.

## 4. Check that every record has its copy

Compare ids, not counts, so a missed record shows by name. In the environment's Databricks SQL
editor:

```sql
USE CATALOG open_jii_<env>;

SELECT 'contributor' AS record_type, user_id AS id FROM centrum.contributor_profiles
UNION ALL
SELECT 'device', id FROM centrum.device_registry;
```

Download the result as CSV, `copies.csv`. In a psql session to the environment's Aurora, from the
folder holding it:

```sql
CREATE TEMP TABLE lakehouse_copies (record_type text, id uuid);
\copy lakehouse_copies FROM 'copies.csv' WITH (FORMAT csv, HEADER)

SELECT 'contributor' AS record_type, p.user_id AS id FROM profiles p
LEFT JOIN lakehouse_copies c ON c.record_type = 'contributor' AND c.id = p.user_id
WHERE c.id IS NULL
UNION ALL
SELECT 'device', d.id FROM iot_devices d
LEFT JOIN lakehouse_copies c ON c.record_type = 'device' AND c.id = d.id
WHERE c.id IS NULL;
```

It lists no rows. A record created after the export can show here; step 3 then shows its copy
owed. Owe any other listed record again, naming the ids:

```sql
INSERT INTO experiment_data_outbox (record_type, record_id, destination)
SELECT 'contributor', user_id, 'lakehouse' FROM profiles WHERE user_id IN ('<id>', '<id>')
ON CONFLICT (record_type, record_id, destination) WHERE claimed_at IS NULL DO NOTHING;

INSERT INTO experiment_data_outbox (record_type, record_id, destination)
SELECT 'device', id, 'lakehouse' FROM iot_devices WHERE id IN ('<id>', '<id>')
ON CONFLICT (record_type, record_id, destination) WHERE claimed_at IS NULL DO NOTHING;
```

The check compares Postgres with the export, not with the lakehouse as it is now, so a record
repaired since keeps showing until the export is taken again. Before checking again, download
`copies.csv` anew and reload it:

```sql
TRUNCATE lakehouse_copies;
\copy lakehouse_copies FROM 'copies.csv' WITH (FORMAT csv, HEADER)
```

Then compare the other way, for devices the copy holds and Postgres no longer does. During the
rolling deploy, or a rollback of the backend alone, a task of the previous release can delete a
device without owing anything, and Centrum would keep naming measurements after it:

```sql
SELECT c.id FROM lakehouse_copies c
LEFT JOIN iot_devices d ON d.id = c.id
WHERE c.record_type = 'device' AND d.id IS NULL;
```

It lists no rows. Owe every device it lists: the copy finds no such device in Postgres, and deletes
its row.

```sql
INSERT INTO experiment_data_outbox (record_type, record_id, destination)
SELECT 'device'::experiment_data_record_type, c.id, 'lakehouse'::experiment_data_destination
FROM lakehouse_copies c
LEFT JOIN iot_devices d ON d.id = c.id
WHERE c.record_type = 'device' AND d.id IS NULL
ON CONFLICT (record_type, record_id, destination) WHERE claimed_at IS NULL DO NOTHING;
```

Profiles need no such check: closing an account keeps its profile row.

The same step 2 insert refills either table if it is ever emptied. Delete `copies.csv` once the
check is clean; it holds every account's id.

## 5. Restart Centrum

First wait for this release's bundle. In the GitHub Actions run that deploys this release to the
environment, the Deploy Databricks job must have succeeded. It needs Deploy Backend, so it can
still be queued, or have failed, after step 1. A restart before it lands starts Centrum on the
previous notebooks, and the checks below cannot tell, since the previous gold asks the backend's
routes this release keeps. If the job failed, run it again, and restart only once it succeeds.

Stop Centrum in the Databricks workspace, wait until it reads `IDLE`, and start it again, without a
full refresh. It comes back on the new bundle's notebooks, which join the copies. A restart often
takes more than ten minutes, and measurements wait in Kinesis meanwhile.

Then check, in the SQL editor, that names stayed in place:

```sql
SELECT count_if(user.name = '') AS blank, count(*) AS contributors
FROM centrum.experiment_contributors;

SELECT count_if(device.id IS NULL AND startswith(client_id, 'ambyte_')) AS unregistered_ambytes
FROM centrum.experiment_devices;
```

Run both before you stop Centrum, and again once it runs: each reads the same before and after the
restart. A user without a profile reads blank in both, as the backend's lookup left them.

Centrum may also restart before step 5 on its own, after a recoverable failure, once the bundle
has deployed. It then joins copies that are still filling, and names read blank until step 3
drains. Finish steps 2 and 3: the names come back as the copies land, and this is no reason to
roll back.

## 6. Clear the names the annotations' copy kept

Once step 5's checks read the same after the restart, the cutover is confirmed. The lakehouse's copy
of annotations still holds the author names written before this release, which nothing writes or
reads any more. A deactivated or closed account's real name would stay there, while
`contributor_profiles` masks it. Clear them in the SQL editor:

```sql
UPDATE open_jii_<env>.centrum.experiment_annotations SET user_name = NULL;
```

A later release drops the column.

## Rolling back

Deploy the previous release with its infrastructure, not only its backend and bundle. OpenTofu
applies the enriched views (`module "enriched_views"` in `infrastructure/env/<env>/main.tf`), and
this release's views name an annotation's author from `contributor_profiles`, which the previous
backend no longer updates. Without the infrastructure, the views, and every export, keep reading it.
The previous release's plan also destroys `contributor_profiles` and `device_registry`, which it
does not define.

The previous release's tasks never claim a `contributor` or `device` row, so step 2's rows, and
every copy the new tasks owed, would wait and fire `experiment-data-outbox-waiting`. Whenever the
rollback comes, before step 5 or after it, delete them once it is out:

```sql
DELETE FROM experiment_data_outbox WHERE record_type IN ('contributor', 'device');
```

Before step 5, Centrum still runs the previous notebooks, unless it restarted on its own. After
step 5, or after such a restart, restart Centrum once the previous bundle is out: its gold tables
then call the backend again, and the previous backend serves them.

This release copies annotations to the lakehouse without `user_name`, the column the previous
release's enriched views read an annotation's author from. Once the previous backend is out, owe
every annotation, so the previous backend writes each author's name again. Owe all of them on every
rollback, not only those changed since the rollout: this release owes no annotation when its
author's profile changes, so an older annotation can still hold a name its author has since
changed, or a real name since deactivated or closed, and an addition owed before the rollout can
land without a name. Step 6, if it ran, cleared every name too.

```sql
INSERT INTO experiment_data_outbox (record_type, record_id, experiment_id, destination)
SELECT 'annotation'::experiment_data_record_type, id, experiment_id,
       'lakehouse'::experiment_data_destination
FROM experiment_annotations
ON CONFLICT (record_type, record_id, destination) WHERE claimed_at IS NULL DO NOTHING;
```

Wait until `SELECT count(*) FROM experiment_data_outbox WHERE record_type = 'annotation'` reads 0,
then check a few annotations whose authors you know in the SQL editor, among them one whose author
changed their name or deactivated their profile during the release, if there is one:

```sql
SELECT id, user_id, user_name FROM open_jii_<env>.centrum.experiment_annotations
WHERE id IN ('<id>', '<id>', '<id>');
```

Each names its author as the platform shows them now, `Unknown User` for a deactivated profile.

When the release comes back, run steps 1 to 5 again: the copies missed every change made meanwhile,
and a Centrum the rollback restarted keeps the previous notebooks until step 5 restarts it. Then run
step 6 again, since the previous release wrote names back.

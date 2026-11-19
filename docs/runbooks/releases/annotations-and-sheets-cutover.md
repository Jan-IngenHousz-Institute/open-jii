# annotations-and-sheets-cutover

**Moves annotations and metadata sheets from the lakehouse to Postgres in one release, off-hours,
instead of two.** The usual path ships a first release that writes both stores, runs
[annotations-move](annotations-move.md) and [metadata-sheets-move](metadata-sheets-move.md), then
ships a second release that makes Postgres the source. Use this page instead when one release
carries both, so an environment goes from writing the lakehouse alone straight to reading Postgres.

The pull requests behind both releases, #2402, #2424 and #2425, merge back to back, and no
production release is cut between them, so production takes all three in one release. This page
needs #2424: it adds the outbox that step 5 and step 7 owe copies through, and the outbox steps of
the move runbooks' section "Before the second release, and after".

## Before you start

Follow this page as it stands only on an environment that never ran a first-release build. A
backend from v1.151.0 on writes annotations to both stores, and one built from main after #2402
merged but before #2424 did writes sheets to both. Dev has run both, since it deploys main on every
push. The image tag of the ECS service's task definition names the version an environment runs.

On an environment that did run one, first run steps 1 to 5 of both move runbooks to a clean check
while the lakehouse is still the source, on dev between the merges of #2402 and #2424. That check
makes Postgres match the lakehouse wherever the first release left them apart, such as a delete or
an edit whose Postgres copy failed. Old tasks keep writing both stores until the cutoff in step 2,
so a "not copied to Postgres" warning the backend logs after the check's second export names a
record to settle the same way, by hand, before step 4. Then follow this page.

From the moment the release is out until step 4 ends, pages show no annotation or sheet Postgres
lacks, and editing or deleting one answers that it was not found. On an environment that never ran
a first release, that is every one written before the release; after a clean check, it is none.
New annotations and sheets save as usual. So run it when nobody annotates: the query in step 1
shows when that is.

## 1. Before the night

Run step 1 of both move runbooks on the environment's Investigations warehouse, and correct
whatever they list, so the new release's API can keep every record. Then pick the hour with the
fewest writes over the last 30 days:

```sql
SELECT hour(updated_at) AS utc_hour, count(*) AS writes FROM (
  SELECT updated_at FROM centrum.experiment_annotations
  UNION ALL
  SELECT updated_at FROM centrum.experiment_custom_metadata
) WHERE updated_at >= current_timestamp() - INTERVAL 30 DAYS
GROUP BY 1 ORDER BY 2, 1;
```

## 2. Ship the release and note when it finished

Note the time the deploy starts, in UTC. Wait until every backend task runs the new release (the
ECS service shows one deployment, and none of the old task definition), and note that time too.
That second time is the cutoff: until it, old tasks may still have written to the lakehouse alone.
Step 4 copies what was created before the deploy start, and step 6 settles what was created between
the two.

## 3. Export the lakehouse's records

After the cutoff, run step 2 of both move runbooks for a first export, then step 3 of both to load
them beside Postgres in one psql session.

## 4. Copy the records created before the deploy started

Only records created before the deploy start come from the lakehouse unattended. Until this step
ends, a new task asked to edit or delete one by its id answers that it was not found, and no old
task runs after the cutoff, so the export holds each as it last stood. A bulk annotation delete is
the exception: it removes the annotations Postgres holds on the rows it names and succeeds, so one
it also meant to remove can come back here, and step 5 removes it again. A record Postgres already
holds is never replaced: by now Postgres is the source.

Run both statements in one transaction. If it fails, it rolls back and can run again on the same
export. Once it commits, never run it again: researchers can delete these records from then on,
and a second run would bring a deleted one back.

```sql
BEGIN;

INSERT INTO experiment_annotations
SELECT l.* FROM lakehouse_annotations l JOIN experiments e ON e.id = l.experiment_id
WHERE l.created_at < '<deploy start>'
ON CONFLICT (id) DO NOTHING;

INSERT INTO experiment_metadata_sheets
  (id, experiment_id, metadata, created_by, created_at, updated_at)
SELECT l.id, l.experiment_id, l.metadata::jsonb, l.created_by, l.created_at, l.updated_at
FROM lakehouse_sheets l JOIN experiments e ON e.id = l.experiment_id
WHERE l.created_at < '<deploy start>'
ON CONFLICT (id) DO NOTHING;

COMMIT;
```

## 5. Remove again what a bulk delete asked to remove

A bulk annotation delete names a table, a kind and rows, and removes the annotations of that kind
that Postgres holds on those rows. Until step 4 committed, Postgres lacked the rows' older
annotations, so step 4 brought back any of them such a delete was meant to remove. List the bulk
deletes of that span in CloudWatch Logs Insights, on `/aws/ecs/backend-service-<env>`, with the time
range set from the deploy start to step 4's commit:

```text
fields @timestamp, experimentId, userId, tableName, type, @message
| filter msg = "Deleting annotation(s) from experiment data" and req.url like /bulk-delete$/
| sort @timestamp asc
```

Most nights this lists nothing. A line without a `tableName` came from an old task before the
cutoff, which removed the annotations from the lakehouse itself, so the export already lacked them.
For every other line, take the row ids from `rowIds` in its message, and in the psql session remove
the annotations of that kind on those rows that step 4 brought back, owing each removal:

```sql
WITH removed AS (
  DELETE FROM experiment_annotations
  WHERE experiment_id = '<experimentId>' AND table_name = '<tableName>' AND type = '<type>'
    AND row_id IN ('<row id>', '<row id>') AND created_at < '<deploy start>'
  RETURNING id, experiment_id
)
INSERT INTO experiment_data_outbox (record_type, record_id, experiment_id, destination)
SELECT 'annotation', id, experiment_id, 'lakehouse' FROM removed
ON CONFLICT (record_type, record_id, destination) WHERE claimed_at IS NULL DO NOTHING;
```

The backend then removes their copies from the lakehouse. Note each line's experiment in OJD-2153.

## 6. Settle the rollout's records by hand

A record created between the deploy start and the cutoff may come from either release. An old task
wrote it to the lakehouse alone, or a new task wrote it to Postgres and may have deleted it there
while its removal from the lakehouse still waits. The export cannot tell the two apart, so none of
these is copied unattended. List the ones in the lakehouse but not in Postgres:

```sql
SELECT 'annotation' AS kind, l.id, l.created_at FROM lakehouse_annotations l
LEFT JOIN experiment_annotations a ON a.id = l.id
WHERE l.created_at >= '<deploy start>' AND l.created_at < '<cutoff>' AND a.id IS NULL
UNION ALL
SELECT 'sheet', l.id, l.created_at FROM lakehouse_sheets l
LEFT JOIN experiment_metadata_sheets s ON s.id = l.id
WHERE l.created_at >= '<deploy start>' AND l.created_at < '<cutoff>' AND s.id IS NULL;
```

Off-hours this lists nothing. A row it does list needs a person: ask its author whether it should
exist. Only if it should, copy it once with step 4's INSERT, its `WHERE` replaced by
`WHERE l.id = '<id>'`. Note any such id in OJD-2153.

## 7. Check, once

Wait until the outbox owes nothing, as the move runbooks' section "Before the second release, and
after" shows, then run step 5 of both move runbooks with a fresh export. A record in the lakehouse
alone was removed in Postgres since it got there, whether by step 4 or 6 or by its own save, and
the removal's copy has not landed; or its experiment is gone from Postgres. Owe its removal again,
as that section shows. A record missing or older in the lakehouse is a copy still owed: owe it again
the same way. A record created between the deploy start and the cutoff is the exception: an old
task may have edited or deleted it after its copy landed, so ask its author before owing anything
for it. A record from before the deploy start that the lakehouse holds newer than Postgres, or
differently at the same time, is a first-release write whose Postgres copy failed and was not
settled before step 4: a person decides which is right, and nothing is owed until they have. Never
run step 4 again and never delete from Postgres: from here on, Postgres is right, and only the
outbox writes the lakehouse.

Delete the exports and any parts once the checks are clean. They hold researchers' data.

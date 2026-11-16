# annotations-and-sheets-cutover

**Moves annotations and metadata sheets from the lakehouse to Postgres in one release, off-hours,
instead of two.** The usual path ships a first release that writes both stores, runs
[annotations-move](annotations-move.md) and [metadata-sheets-move](metadata-sheets-move.md), then
ships a second release that makes Postgres the source. Use this page instead when one release
carries both, so an environment goes from writing the lakehouse alone straight to reading Postgres.

From the moment the release is out until step 4 ends, pages show no annotation or sheet written
before it, and editing or deleting one answers that it was not found. New annotations and sheets
save as usual. So run it when nobody annotates: the query in step 1 shows when that is.

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

## 3. Export the lakehouse's records

Run step 2 of both move runbooks for a first export, then step 3 of both to load them beside
Postgres in one psql session.

## 4. Copy the records written before the cutoff

Only records created before the cutoff come from the lakehouse. A record created after it started in
Postgres, so the lakehouse holds at most a copy of it, which must never come back. A record Postgres
already holds is never replaced: by now Postgres is the source.

```sql
INSERT INTO experiment_annotations
SELECT l.* FROM lakehouse_annotations l JOIN experiments e ON e.id = l.experiment_id
WHERE l.created_at < '<cutoff>'
ON CONFLICT (id) DO NOTHING;

INSERT INTO experiment_metadata_sheets
  (id, experiment_id, metadata, created_by, created_at, updated_at)
SELECT l.id, l.experiment_id, l.metadata::jsonb, l.created_by, l.created_at, l.updated_at
FROM lakehouse_sheets l JOIN experiments e ON e.id = l.experiment_id
WHERE l.created_at < '<cutoff>'
ON CONFLICT (id) DO NOTHING;
```

Then list what was created during the rollout and is in the lakehouse but not in Postgres. An old
task took it and Postgres never heard of it, or a new task took it and it was deleted since:

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
exist, and copy it with the step's INSERT and `AND l.id = '<id>'` only if it should. Note any such
id in OJD-2153.

## 5. Check, once

Wait until the outbox owes nothing, as the move runbooks' last section shows, then run step 5 of both
move runbooks with a fresh export. A record in the lakehouse alone was removed in Postgres since it
got there, whether by step 4 or by its own save, and the removal's copy has not landed; or its
experiment is gone from Postgres. Owe its removal again, as that section shows. A record missing or
older in the lakehouse is a copy still owed: owe it again the same way. Never run step 4 again and
never delete from Postgres: from here on, Postgres is right, and only the outbox writes the
lakehouse.

Delete the exports and any parts once the checks are clean. They hold researchers' data.

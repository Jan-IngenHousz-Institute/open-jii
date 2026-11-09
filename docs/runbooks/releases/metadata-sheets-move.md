# metadata-sheets-move

**Copies every custom metadata sheet the lakehouse holds into Postgres, with its id and times, and
checks that both hold the same.** Sheets are moving from the lakehouse table
`centrum.experiment_custom_metadata` to Postgres (OJD-2153), in the same two releases as
annotations ([annotations-move](annotations-move.md)):

1. The first writes every new sheet, edit and delete to the lakehouse as before and to Postgres in
   the same request. Pages still read the lakehouse.
2. The second writes Postgres first and reads sheets from it.

These steps run by hand between the two, on each environment, once the first release is out there,
in the same session as the annotations move. They are a copy done once, so nothing in the
repository runs them.

## 1. Check that Postgres can keep every sheet

In the environment's Databricks SQL editor, in the environment's catalog, which steps 2 and 5
use too:

```sql
USE CATALOG open_jii_<env>;

SELECT metadata_id, experiment_id, created_by
FROM centrum.experiment_custom_metadata
WHERE metadata_id IS NULL OR experiment_id IS NULL OR metadata IS NULL OR created_by IS NULL
   OR created_at IS NULL OR updated_at IS NULL
   OR NOT lower(metadata_id) RLIKE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR NOT lower(experiment_id) RLIKE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR NOT lower(created_by) RLIKE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR instr(to_json(metadata), '\\u0000') > 0;

SELECT metadata_id, count(*) FROM centrum.experiment_custom_metadata
GROUP BY metadata_id HAVING count(*) > 1;
```

Expect no rows from either. Postgres refuses any of the first, and the API refuses them since the
first release; step 4 refuses an id held twice. The last condition also catches a sheet whose text
holds the six characters `\u0000` rather than a NUL character, which Postgres keeps: look at any
such sheet before correcting it. Decide with the team what each one should be and correct it in the
lakehouse before going on.

## 2. Export the lakehouse's sheets

In the same editor:

```sql
SET TIME ZONE 'UTC';
SELECT metadata_id AS id, experiment_id, to_json(metadata) AS metadata, created_by,
       date_format(created_at, 'yyyy-MM-dd HH:mm:ss.SSSSSS') AS created_at,
       date_format(updated_at, 'yyyy-MM-dd HH:mm:ss.SSSSSS') AS updated_at
FROM centrum.experiment_custom_metadata;

SELECT count(*), sum(length(to_json(metadata))) FROM centrum.experiment_custom_metadata;
```

Note the time you ran it, in UTC, and the two numbers the last query gives, then download the
export's result as CSV, `sheets.csv`. If the editor cuts the download short of the count, export it
in parts with a `WHERE experiment_id IN (...)`.

## 3. Load it beside Postgres's sheets

In a psql session to the environment's Aurora, as the admin, from the folder holding the CSV:

```sql
CREATE TEMP TABLE lakehouse_sheets (
  id uuid, experiment_id uuid, metadata text, created_by uuid,
  created_at timestamp, updated_at timestamp
);
\copy lakehouse_sheets FROM 'sheets.csv' WITH (FORMAT csv, HEADER)
SELECT count(*), sum(length(metadata)) FROM lakehouse_sheets;
```

Both numbers must match the export's. When they do not, or `\copy` stops on a row, the download was
cut short or mangled: export again in parts as step 2 says, and load each part. The document stays
text here so its length can be compared with the export's; Postgres reorders a document's keys once
it is `jsonb`.

## 4. Copy what Postgres lacks or holds older

```sql
INSERT INTO experiment_metadata_sheets
SELECT l.id, l.experiment_id, l.metadata::jsonb, l.created_by, l.created_at, l.updated_at
FROM lakehouse_sheets l JOIN experiments e ON e.id = l.experiment_id
ON CONFLICT (id) DO UPDATE SET
  experiment_id = EXCLUDED.experiment_id, metadata = EXCLUDED.metadata,
  created_by = EXCLUDED.created_by, created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at
WHERE experiment_metadata_sheets.updated_at < EXCLUDED.updated_at;
```

Sheets of experiments Postgres no longer has stay behind, since Postgres removes an experiment's
sheets with it. A sheet Postgres already holds is replaced only when the lakehouse's copy is newer,
so an add or an edit the first release made after the export stands. A delete made after it is
undone by this step, and only a second export shows it.

## 5. Export again and check both sides

Repeat step 2 for a second export, `sheets-2.csv`, and load it in place of the first:

```sql
TRUNCATE lakehouse_sheets;
\copy lakehouse_sheets FROM 'sheets-2.csv' WITH (FORMAT csv, HEADER)
SELECT count(*), sum(length(metadata)) FROM lakehouse_sheets;
```

Both numbers must match the second export's. Then:

```sql
-- Sheets the lakehouse held that Postgres lacks or holds differently.
SELECT l.id, l.updated_at, s.updated_at AS in_postgres
FROM lakehouse_sheets l
JOIN experiments e ON e.id = l.experiment_id
LEFT JOIN experiment_metadata_sheets s ON s.id = l.id
WHERE s.id IS NULL
   OR (s.experiment_id, s.metadata, s.created_by, s.created_at, s.updated_at)
      IS DISTINCT FROM
      (l.experiment_id, l.metadata::jsonb, l.created_by, l.created_at, l.updated_at);

-- Sheets in Postgres the lakehouse did not hold at the export.
SELECT s.id, s.created_at, s.updated_at
FROM experiment_metadata_sheets s
LEFT JOIN lakehouse_sheets l ON l.id = s.id
WHERE l.id IS NULL;

-- Sheets of experiments that are gone, which stay behind.
SELECT count(*) FROM lakehouse_sheets l
LEFT JOIN experiments e ON e.id = l.experiment_id WHERE e.id IS NULL;
```

`jsonb` compares documents by their values, so key order and number spelling (`1.0` against `1`)
do not count. The first query is clean when every row it returns was edited in Postgres after the
second export, so `in_postgres` is the newer time. The second is clean when every row was created
after the second export. A row created before it is a delete that step 4 undid, or one whose copy
to Postgres failed, for which the service's log warns "not copied to Postgres". Check it is gone
from the lakehouse and delete it from Postgres.

A row of the first query whose `in_postgres` is older, or empty, is a change the lakehouse took
that Postgres missed, such as an edit to a sheet step 4 had not reached yet. Run step 4
again with this export, then step 5's checks again.

## Before the second release, and after

Run this in the same session as [annotations-move](annotations-move.md). The second release goes out
only when both are clean.

Run steps 1 to 5 again right before the second release goes out, with a fresh export; a clean check
is what lets it go. Once it is out, run steps 2 and 3 and step 5's checks once more without step 4,
since Postgres is then where sheets are written: a difference is a write the first release's tasks
took while the second rolled out, whose copy failed. Note its id in OJD-2153.

Delete `sheets.csv`, `sheets-2.csv` and any parts once the checks are clean. They hold
researchers' data.

# annotations-move

**Copies every annotation the lakehouse holds into Postgres, with its id and times, and checks that
both hold the same.** Annotations are moving from the lakehouse table
`centrum.experiment_annotations` to Postgres (OJD-2153). The move takes two releases:

1. The first writes every new annotation, edit and delete to the lakehouse as before and to
   Postgres in the same request. Pages still read the lakehouse.
2. The second writes Postgres first and fills pages from it.

These steps run by hand between the two, on each environment, once the first release is out there.
They are a copy done once, so nothing in the repository runs them.

## 1. Check that Postgres can keep every annotation

In the environment's Databricks SQL editor, in the environment's catalog, which steps 2 and 5
use too:

```sql
USE CATALOG open_jii_<env>;

SELECT id, experiment_id, user_id, type, length(row_id), length(table_name), flag_type,
       length(content_text)
FROM centrum.experiment_annotations
WHERE type NOT IN ('comment', 'flag') OR flag_type NOT IN ('outlier', 'needs_review')
   OR length(row_id) > 64 OR length(table_name) > 64 OR instr(content_text, char(0)) > 0
   OR instr(row_id, char(0)) > 0 OR instr(table_name, char(0)) > 0
   OR length(content_text) > 255 OR (type = 'flag' AND flag_type IS NULL)
   OR (type = 'comment' AND (content_text IS NULL OR content_text = ''))
   OR id IS NULL OR experiment_id IS NULL OR table_name IS NULL OR row_id IS NULL
   OR type IS NULL OR user_id IS NULL OR created_at IS NULL OR updated_at IS NULL
   OR NOT lower(id) RLIKE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR NOT lower(experiment_id) RLIKE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR NOT lower(user_id) RLIKE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

SELECT id, count(*) FROM centrum.experiment_annotations GROUP BY id HAVING count(*) > 1;

SELECT table_name, count(*) FROM centrum.experiment_annotations GROUP BY table_name ORDER BY 1;
```

Expect no rows from the first two. The API refuses all of the first since the first release, and
Postgres refuses most of them. The rest, a flag without a kind, a comment without text or text over
255 characters, fit Postgres but are annotations the API could not have written. Step 4 refuses an
id held twice. Decide with the team what each one should be and correct it in the lakehouse before
going on. The third lists the tables annotated, which should be `raw_data`, macro ids and upload
table ids only, since the second release finds a row by its table and row id.

## 2. Export the lakehouse's annotations

In the same editor:

```sql
SET TIME ZONE 'UTC';
SELECT to_json(named_struct(
         'id', id, 'experiment_id', experiment_id, 'table_name', table_name, 'row_id', row_id,
         'type', type, 'content_text', content_text, 'flag_type', flag_type, 'created_by', user_id,
         'created_at', date_format(created_at, 'yyyy-MM-dd HH:mm:ss.SSSSSS'),
         'updated_at', date_format(updated_at, 'yyyy-MM-dd HH:mm:ss.SSSSSS'))) AS annotation
FROM centrum.experiment_annotations;

SELECT count(*), sum(length(content_text)) FROM centrum.experiment_annotations;
```

Note the time you ran it, in UTC, and the two numbers the last query gives, then download the
export's result as CSV. If the editor cuts the download short of the count, export it in parts with
a `WHERE experiment_id IN (...)`. `user_name` is not copied; pages look names up at read time.

Each row goes out as one JSON document because the editor's download writes a NULL as the text
`null`, which a column of its own could not tell from a comment that reads null. The document
leaves a NULL field out, and step 3 reads a missing field back as NULL.

## 3. Load it beside Postgres's annotations

In a psql session to the environment's Aurora, as the admin, from the folder holding the CSV:

```sql
CREATE TEMP TABLE lakehouse_export (annotation jsonb);
\copy lakehouse_export FROM 'annotations.csv' WITH (FORMAT csv, HEADER)
CREATE TEMP TABLE lakehouse_annotations AS
SELECT r.* FROM lakehouse_export, jsonb_populate_record(NULL::experiment_annotations, annotation) r;
SELECT count(*), sum(length(content_text)) FROM lakehouse_annotations;
```

Both numbers must match the export's. When they do not, or `\copy` stops on a row, the download was
cut short or mangled: export again in parts as step 2 says, `\copy` each part into
`lakehouse_export`, then build `lakehouse_annotations`.

## 4. Copy what Postgres lacks or holds older

```sql
INSERT INTO experiment_annotations
SELECT l.* FROM lakehouse_annotations l JOIN experiments e ON e.id = l.experiment_id
ON CONFLICT (id) DO UPDATE SET
  experiment_id = EXCLUDED.experiment_id, table_name = EXCLUDED.table_name,
  row_id = EXCLUDED.row_id, type = EXCLUDED.type, content_text = EXCLUDED.content_text,
  flag_type = EXCLUDED.flag_type, created_by = EXCLUDED.created_by,
  created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at
WHERE experiment_annotations.updated_at < EXCLUDED.updated_at;
```

Annotations of experiments Postgres no longer has stay behind, since Postgres removes an
experiment's annotations with it. A row Postgres already holds is replaced only when the
lakehouse's copy is newer, so an add or an edit the first release made after the export stands. A
delete made after it is undone by this step, and only a second export shows it.

## 5. Export again and check both sides

Repeat step 2 for a second export, `annotations-2.csv`, and load it in place of the first:

```sql
TRUNCATE lakehouse_export, lakehouse_annotations;
\copy lakehouse_export FROM 'annotations-2.csv' WITH (FORMAT csv, HEADER)
INSERT INTO lakehouse_annotations
SELECT r.* FROM lakehouse_export, jsonb_populate_record(NULL::experiment_annotations, annotation) r;
SELECT count(*), sum(length(content_text)) FROM lakehouse_annotations;
```

Both numbers must match the second export's. Then:

```sql
-- Annotations the lakehouse held that Postgres lacks or holds differently.
SELECT l.id, l.updated_at, a.updated_at AS in_postgres
FROM lakehouse_annotations l
JOIN experiments e ON e.id = l.experiment_id
LEFT JOIN experiment_annotations a ON a.id = l.id
WHERE a.id IS NULL
   OR (a.experiment_id, a.table_name, a.row_id, a.type, a.content_text, a.flag_type,
       a.created_by, a.created_at, a.updated_at)
      IS DISTINCT FROM
      (l.experiment_id, l.table_name, l.row_id, l.type, l.content_text, l.flag_type,
       l.created_by, l.created_at, l.updated_at);

-- Annotations in Postgres the lakehouse did not hold at the export.
SELECT a.id, a.created_at, a.updated_at
FROM experiment_annotations a
LEFT JOIN lakehouse_annotations l ON l.id = a.id
WHERE l.id IS NULL;

-- Annotations of experiments that are gone, which stay behind.
SELECT count(*) FROM lakehouse_annotations l
LEFT JOIN experiments e ON e.id = l.experiment_id WHERE e.id IS NULL;
```

The first query is clean when every row it returns was edited in Postgres after the second export,
so `in_postgres` is the newer time. The second is clean when every row was created after the second
export. A row created before it is a delete that step 4 undid, or one whose copy to Postgres failed,
for which the service's log warns "not copied to Postgres". Check it is gone from the lakehouse and
delete it from Postgres.

A row of the first query whose `in_postgres` is older, or empty, is a change the lakehouse took
that Postgres missed, such as an edit to an annotation step 4 had not reached yet. Run step 4
with this export, then step 5's checks again.

A row whose `in_postgres` equals the lakehouse's time, or is newer but from before the second
export, holds two edits of one annotation that reached the two stores in opposite orders. Step 4
never replaces it. The first release's pages show the lakehouse's copy, so make Postgres match it,
naming the rows' ids, then run step 5's checks again:

```sql
UPDATE experiment_annotations a
SET experiment_id = l.experiment_id, table_name = l.table_name, row_id = l.row_id,
    type = l.type, content_text = l.content_text, flag_type = l.flag_type,
    created_by = l.created_by, created_at = l.created_at, updated_at = l.updated_at
FROM lakehouse_annotations l
WHERE a.id = l.id AND a.id IN ('<id>', '<id>');
```

## Before the second release, and after

Run steps 1 to 5 again right before the second release goes out, with a fresh export; a clean check
is what lets it go. Once it is out, run steps 2 and 3 and step 5's checks once more without step 4,
since Postgres is then where annotations are written: a difference is a write the first release's
tasks took while the second rolled out, whose copy failed. Note its id in OJD-2153.

Delete `annotations.csv`, `annotations-2.csv` and any parts once the checks are clean. They hold
researchers' data.

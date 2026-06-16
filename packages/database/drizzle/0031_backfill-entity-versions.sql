-- Backfill for per-entity versioning.
--
--   1. Create version 1 for every existing macro/protocol from its current code.
--      (macros/protocols.latest_version already defaults to 1 via 0030.)
--   2. Pin every existing MACRO workbook cell to version 1 by adding
--      payload.version = 1, in both workbooks.cells and workbook_versions.cells.
--      Protocol cells already carry payload.version (set by 0026 / the picker).
--
-- Idempotent: version inserts guard on NOT EXISTS; cell rewrites only touch rows
-- that still have a macro cell without a version.

INSERT INTO macro_versions (macro_id, version, code, language, created_by, created_at)
SELECT m.id, 1, m.code, m.language, m.created_by, m.created_at
FROM macros m
WHERE NOT EXISTS (SELECT 1 FROM macro_versions mv WHERE mv.macro_id = m.id);
--> statement-breakpoint

INSERT INTO protocol_versions (protocol_id, version, code, family, created_by, created_at)
SELECT p.id, 1, p.code, p.family, p.created_by, p.created_at
FROM protocols p
WHERE NOT EXISTS (SELECT 1 FROM protocol_versions pv WHERE pv.protocol_id = p.id);
--> statement-breakpoint

UPDATE workbooks w
SET cells = sub.new_cells
FROM (
  SELECT
    w2.id,
    jsonb_agg(
      CASE
        WHEN elem->>'type' = 'macro' AND (elem->'payload'->>'version') IS NULL
          THEN jsonb_set(elem, '{payload,version}', '1'::jsonb, true)
        ELSE elem
      END
      ORDER BY ord
    ) AS new_cells
  FROM workbooks w2,
       jsonb_array_elements(w2.cells) WITH ORDINALITY AS t(elem, ord)
  WHERE jsonb_typeof(w2.cells) = 'array'
    AND jsonb_array_length(w2.cells) > 0
  GROUP BY w2.id
) sub
WHERE w.id = sub.id
  AND jsonb_typeof(w.cells) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(w.cells) e
    WHERE e->>'type' = 'macro' AND (e->'payload'->>'version') IS NULL
  );
--> statement-breakpoint

UPDATE workbook_versions wv
SET cells = sub.new_cells
FROM (
  SELECT
    wv2.id,
    jsonb_agg(
      CASE
        WHEN elem->>'type' = 'macro' AND (elem->'payload'->>'version') IS NULL
          THEN jsonb_set(elem, '{payload,version}', '1'::jsonb, true)
        ELSE elem
      END
      ORDER BY ord
    ) AS new_cells
  FROM workbook_versions wv2,
       jsonb_array_elements(wv2.cells) WITH ORDINALITY AS t(elem, ord)
  WHERE jsonb_typeof(wv2.cells) = 'array'
    AND jsonb_array_length(wv2.cells) > 0
  GROUP BY wv2.id
) sub
WHERE wv.id = sub.id
  AND jsonb_typeof(wv.cells) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(wv.cells) e
    WHERE e->>'type' = 'macro' AND (e->'payload'->>'version') IS NULL
  );

-- Backfill entity_snapshots for workbook versions that were created without
-- them (notably by the 0026 flow→workbook migration). For each affected
-- version, walk its cells, look up referenced protocols and macros, and embed
-- their current code into entity_snapshots. Idempotent: only touches rows
-- where entity_snapshots is still the empty default.

DO $$
DECLARE
  rec RECORD;
  v_protocol_ids uuid[];
  v_macro_ids uuid[];
  v_protocol_snaps jsonb;
  v_macro_snaps jsonb;
BEGIN
  FOR rec IN
    SELECT id, cells
    FROM workbook_versions
    WHERE entity_snapshots = '{"protocols":{},"macros":{}}'::jsonb
  LOOP
    SELECT COALESCE(array_agg(DISTINCT (cell->'payload'->>'protocolId')::uuid), ARRAY[]::uuid[])
      INTO v_protocol_ids
    FROM jsonb_array_elements(rec.cells) AS cell
    WHERE cell->>'type' = 'protocol'
      AND cell->'payload'->>'protocolId' IS NOT NULL;

    SELECT COALESCE(array_agg(DISTINCT (cell->'payload'->>'macroId')::uuid), ARRAY[]::uuid[])
      INTO v_macro_ids
    FROM jsonb_array_elements(rec.cells) AS cell
    WHERE cell->>'type' = 'macro'
      AND cell->'payload'->>'macroId' IS NOT NULL;

    SELECT COALESCE(jsonb_object_agg(p.id::text, jsonb_build_object('code', p.code)), '{}'::jsonb)
      INTO v_protocol_snaps
    FROM protocols p
    WHERE p.id = ANY(v_protocol_ids);

    SELECT COALESCE(jsonb_object_agg(m.id::text, jsonb_build_object('code', m.code)), '{}'::jsonb)
      INTO v_macro_snaps
    FROM macros m
    WHERE m.id = ANY(v_macro_ids);

    UPDATE workbook_versions
    SET entity_snapshots = jsonb_build_object(
      'protocols', v_protocol_snaps,
      'macros', v_macro_snaps
    )
    WHERE id = rec.id;
  END LOOP;
END $$;

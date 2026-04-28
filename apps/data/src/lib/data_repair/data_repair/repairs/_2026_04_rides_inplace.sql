-- =============================================================================
-- Verification queries for _2026_04_rides_inplace.py (OJD-571 / GH#1056).
--
-- Swap catalog (`open_jii_prod` -> `open_jii_dev`) per environment.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- before: confirm the macro IDs match this environment.
-- Macro UUIDs are assigned at insert time, so the IDs in the repair file may
-- not match a fresh dev catalog. Run this first; if the names line up but the
-- IDs differ, update _RIDES_MACRO_IDS in the .py before deploying.
-- -----------------------------------------------------------------------------
SELECT DISTINCT macro.id, macro.name, macro.filename
FROM open_jii_prod.centrum.experiment_raw_data
LATERAL VIEW EXPLODE(macros) AS macro
WHERE macro.name ILIKE '%RIDES 2.0%' OR macro.name ILIKE '%RIDES 2.1%';


-- -----------------------------------------------------------------------------
-- before: pre-fix vs post-fix volume.
-- Sets expectations for full-refresh row counts. Pre-fix rows are corrupted;
-- post-fix rows in theory should be clean (the after-section confirms whether
-- the mobile fix actually shipped).
-- -----------------------------------------------------------------------------
SELECT
  CASE WHEN processed_timestamp < TIMESTAMP'2026-04-19'
       THEN 'pre_fix' ELSE 'post_fix' END AS era,
  COUNT(*) AS rows
FROM open_jii_prod.centrum.experiment_macro_data
WHERE macro_id IN (
  '21aed8a2-f95b-4f28-b025-44f6d96447e7',
  '5bbf306c-d880-4f04-ac04-dd76fe545182'
)
GROUP BY era;


-- -----------------------------------------------------------------------------
-- before: corruption signature.
-- The bug produces unphysical Phi2/NPQt/FvP_FmP. NPQt < 0 is the cleanest
-- signal (~100% of corrupted rows). If this returns ~0, the predicate doesn't
-- match the actual incident -- do not deploy.
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*) AS suspected_rows,
  SUM(CASE WHEN CAST(try_variant_get(macro_output, '$.NPQt',         'DOUBLE') AS DOUBLE) < 0 THEN 1 ELSE 0 END) AS npqt_negative,
  SUM(CASE WHEN CAST(try_variant_get(macro_output, '$.Phi2',         'DOUBLE') AS DOUBLE) < 0 THEN 1 ELSE 0 END) AS phi2_negative,
  SUM(CASE WHEN CAST(try_variant_get(macro_output, '$.FvP_over_FmP', 'DOUBLE') AS DOUBLE) < 0 THEN 1 ELSE 0 END) AS fvpfmp_negative
FROM open_jii_prod.centrum.experiment_macro_data
WHERE macro_id IN (
  '21aed8a2-f95b-4f28-b025-44f6d96447e7',
  '5bbf306c-d880-4f04-ac04-dd76fe545182'
)
  AND macro_error IS NULL;


-- -----------------------------------------------------------------------------
-- after: NPQt-negative count should be zero.
-- Run this after flipping severity to "apply" and full-refreshing
-- experiment_macro_data (and experiment_macro_data_sandbox).
-- -----------------------------------------------------------------------------
SELECT COUNT(*) AS still_corrupted
FROM open_jii_prod.centrum.experiment_macro_data
WHERE macro_id IN (
  '21aed8a2-f95b-4f28-b025-44f6d96447e7',
  '5bbf306c-d880-4f04-ac04-dd76fe545182'
)
  AND macro_error IS NULL
  AND CAST(try_variant_get(macro_output, '$.NPQt', 'DOUBLE') AS DOUBLE) < 0;


-- -----------------------------------------------------------------------------
-- after: spot-check derived values land in physical ranges.
-- Phi2 in [0, 0.85], NPQt > 0 (typically 0-5), FvP_over_FmP in (0, 1).
-- Eyeball a few rows across both macros to catch any silent miscoding.
-- -----------------------------------------------------------------------------
SELECT
  macro_id,
  raw_id,
  CAST(try_variant_get(macro_output, '$.Phi2',         'DOUBLE') AS DOUBLE) AS phi2,
  CAST(try_variant_get(macro_output, '$.NPQt',         'DOUBLE') AS DOUBLE) AS npqt,
  CAST(try_variant_get(macro_output, '$.FvP_over_FmP', 'DOUBLE') AS DOUBLE) AS fvp_fmp
FROM open_jii_prod.centrum.experiment_macro_data
WHERE macro_id IN (
  '21aed8a2-f95b-4f28-b025-44f6d96447e7',
  '5bbf306c-d880-4f04-ac04-dd76fe545182'
)
  AND macro_error IS NULL
ORDER BY RANDOM()
LIMIT 20;


-- -----------------------------------------------------------------------------
-- after: sandbox vs prod parity for repaired rows.
-- Both gold tables run the same repair on the same input; outputs should
-- match modulo unrelated macro-source drift. Drift > 0 across the RIDES
-- macro_ids would mean one of the two paths failed to apply the repair.
-- -----------------------------------------------------------------------------
SELECT
  emd.macro_id,
  COUNT(*)                                                                                                                           AS rows,
  SUM(CASE WHEN CAST(try_variant_get(emd.macro_output,     '$.NPQt', 'DOUBLE') AS DOUBLE)
            <> CAST(try_variant_get(emds.macro_output,     '$.NPQt', 'DOUBLE') AS DOUBLE) THEN 1 ELSE 0 END)                          AS npqt_mismatches
FROM       open_jii_prod.centrum.experiment_macro_data         emd
INNER JOIN open_jii_prod.centrum.experiment_macro_data_sandbox emds ON emd.id = emds.id
WHERE emd.macro_id IN (
  '21aed8a2-f95b-4f28-b025-44f6d96447e7',
  '5bbf306c-d880-4f04-ac04-dd76fe545182'
)
GROUP BY emd.macro_id;

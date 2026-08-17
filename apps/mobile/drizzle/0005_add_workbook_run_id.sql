-- Adds the derived `workbook_run_id` column, lifted out of the payload at save
-- time so the Recent list can collapse every measurement of one workbook run
-- into a single expandable entry without decompressing measurement_result.
--
-- The column is nullable, so a plain ADD COLUMN is enough (no recreate-and-copy
-- dance). Legacy rows start NULL; the backfill fills them from the payload and
-- writes "" when the payload predates workbook run ids, so a row is never
-- rescanned forever.

ALTER TABLE `measurements` ADD `workbook_run_id` text;

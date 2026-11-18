-- Each payload's JSON text as Spark writes out gold's VARIANT, which is what the warehouse shows,
-- beside the JSON column that filters and sorts read. The JSON type reprints numbers in its own form
-- and keeps no key whose value is null, so pages take their cells from the text. The experiment
-- views select every column and read the text as they are. Rows written before this hold no text
-- until their table is reloaded.
ALTER TABLE macro_results ADD COLUMN IF NOT EXISTS macro_output_text Nullable(String) CODEC(ZSTD(3)) AFTER macro_output;

ALTER TABLE uploads ADD COLUMN IF NOT EXISTS uploaded_data_text Nullable(String) CODEC(ZSTD(3)) AFTER uploaded_data;

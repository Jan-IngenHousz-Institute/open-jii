-- ============================================================================
-- Data migration: repair protocols whose `code` was stored double-encoded.
--
-- `protocols.code` is jsonb, but the write paths serialized the document
-- before handing it to Drizzle, which serializes jsonb itself. The result is a
-- jsonb *string* holding the document rather than the document itself. See
-- OJD-1711.
--
-- This was invisible in the product because the read path (`parseProtocolCode`)
-- accepts both shapes and parses the string on the way out. It is not invisible
-- to SQL: `code -> 0 ->> 'label'` returns null and `jsonb_array_length(code)`
-- errors on these rows, so anything querying protocol structure directly, the
-- data platform included, silently sees nothing.
--
-- Rows are converted one at a time rather than in a single UPDATE: a string that
-- does not parse (a protocol saved while its editor held invalid text, say)
-- would abort the whole statement and take the good rows with it. A protocol's
-- shape is device-defined, so any decoded JSON document is repaired, not only
-- arrays. Anything that fails to parse, or that decodes to a string (where
-- decoding would change the value rather than the encoding), is left exactly
-- as it is and reported, so it can be inspected by hand rather than guessed at
-- here.
--
-- `updated_at` is deliberately not touched. These rows were not edited by their
-- owners, and moving the timestamp would misreport that they were.
-- ============================================================================

DO $$
DECLARE
  row_record RECORD;
  decoded jsonb;
  repaired int := 0;
  skipped int := 0;
BEGIN
  FOR row_record IN
    SELECT id, code #>> '{}' AS raw FROM protocols WHERE jsonb_typeof(code) = 'string'
  LOOP
    BEGIN
      decoded := row_record.raw::jsonb;
    EXCEPTION WHEN others THEN
      skipped := skipped + 1;
      RAISE WARNING 'protocol % left as-is: stored string is not valid JSON', row_record.id;
      CONTINUE;
    END;

    IF jsonb_typeof(decoded) = 'string' THEN
      skipped := skipped + 1;
      RAISE WARNING 'protocol % left as-is: decodes to a string, not a document', row_record.id;
      CONTINUE;
    END IF;

    UPDATE protocols SET code = decoded WHERE id = row_record.id;
    repaired := repaired + 1;
  END LOOP;

  RAISE NOTICE 'protocol code backfill: % repaired, % left as-is', repaired, skipped;
END $$;

-- Unwrap the firmware's sample:[…] compatibility shim (mqtt-payload.md §2).
--
-- The wire keeps a one-element array forever; gold stores the object for writes
-- from this deploy onwards but never rewrites history, so both shapes are in the
-- table and every consumer has to accept both. Calling this makes the '$[0]' in
-- hand-written dashboard SQL optional instead of load-bearing.
--
-- An array with two or more elements is left alone: it is out of contract, and
-- silently keeping only its head would lose data.
CREATE OR REPLACE FUNCTION ${catalog}.${schema}.measurement_object(sample VARIANT)
RETURNS VARIANT
COMMENT 'Unwrap the one-element sample array so the result is the measurement object (mqtt-payload.md 2).'
DETERMINISTIC
RETURN
  CASE
    WHEN try_variant_get(sample, '$[0]') IS NOT NULL
     AND try_variant_get(sample, '$[1]') IS NULL
      THEN try_variant_get(sample, '$[0]')
    ELSE sample
  END

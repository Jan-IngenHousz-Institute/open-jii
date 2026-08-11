-- Normalize a calibration CRC32 to the canonical eight-lowercase-hex-digit
-- spelling (mqtt-payload.md §11.3). v2 rows carry it either way round: an
-- already-hex string, or the unsigned integer the CRC really is.
--
-- Eight decimal digits are also valid hex; hex wins, matching the order the
-- contract states the two rules in.
CREATE OR REPLACE FUNCTION ${catalog}.${schema}.cal_version_hex8(cal_version STRING)
RETURNS STRING
COMMENT 'Normalize a v2 cal_version to eight lowercase hex digits (mqtt-payload.md 11.3).'
DETERMINISTIC
RETURN
  CASE
    WHEN cal_version IS NULL OR trim(cal_version) = '' THEN NULL
    WHEN trim(cal_version) RLIKE '^[0-9a-fA-F]{8}$' THEN lower(trim(cal_version))
    WHEN trim(cal_version) RLIKE '^[0-9]{1,19}$'
      THEN lpad(lower(hex(CAST(trim(cal_version) AS BIGINT))), 8, '0')
    ELSE lower(trim(cal_version))
  END

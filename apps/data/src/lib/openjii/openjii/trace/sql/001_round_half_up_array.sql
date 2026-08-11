-- round_half_up over an array, for the series time and value arrays.
--
-- The rounding expression is repeated here rather than calling round_half_up()
-- from inside the lambda: a scalar SQL UDF invoked within a higher-order function
-- is a construct this DDL does not otherwise rely on, and the whole registration
-- would fail together if it were unsupported. Two copies of five lines, held
-- character-identical by a test, is the cheaper risk.
--
-- NULL elements stay NULL: a hole in a series is data, not something to round.
CREATE OR REPLACE FUNCTION ${catalog}.${schema}.round_half_up_array(
  arr ARRAY<DOUBLE>,
  decimals INT
)
RETURNS ARRAY<DOUBLE>
COMMENT 'Round every element half away from zero at `decimals` places (see round_half_up).'
DETERMINISTIC
RETURN
  transform(
    arr,
    v -> CASE
      WHEN v IS NULL OR decimals IS NULL THEN NULL
      WHEN v < 0 THEN -floor(-v * power(10, decimals) + 0.5) / power(10, decimals)
      ELSE floor(v * power(10, decimals) + 0.5) / power(10, decimals)
    END
  )

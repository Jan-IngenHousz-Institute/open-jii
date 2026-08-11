-- Half away from zero, at a given number of decimals.
--
-- The one rounding primitive every v3 SQL object uses, so the rule lives in one
-- place and is the same rule openjii.trace.round_to applies:
--
--     round_to(x, d) = sign(x) · floor(|x| · 10^d + 0.5) / 10^d
--
-- Two properties matter and neither is free:
--
--   * **Sign-aware.** `floor(x · 10^d + 0.5)` alone is half-up only for x >= 0;
--     for negatives it rounds halves *towards* zero (-24.605 -> -24.60 instead of
--     -24.61). Negative leaf and air temperatures are ordinary science values, so
--     that asymmetry would be a silent data defect, not an edge case.
--   * **Scaled double arithmetic, not a library mode.** Spark's `round(x, d)` is
--     decimal half-up over the shortest decimal representation and Python's
--     `round(x, d)` is ties-to-even; neither matches the other. Doing the same
--     multiply/negate/floor/divide in the same order on both sides makes the two
--     implementations agree bit for bit without depending on how either runtime
--     formats a double.
--
-- Negation is exact in IEEE 754, so (-x)·s and -(x·s) are the same double; the
-- branch changes the rounding direction, never the arithmetic.
CREATE OR REPLACE FUNCTION ${catalog}.${schema}.round_half_up(v DOUBLE, decimals INT)
RETURNS DOUBLE
COMMENT 'Round half away from zero at `decimals` places, matching openjii.trace.round_to.'
DETERMINISTIC
RETURN
  CASE
    WHEN v IS NULL OR decimals IS NULL THEN NULL
    WHEN v < 0 THEN -floor(-v * power(10, decimals) + 0.5) / power(10, decimals)
    ELSE floor(v * power(10, decimals) + 0.5) / power(10, decimals)
  END

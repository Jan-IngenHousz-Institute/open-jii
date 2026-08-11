-- The generic timeseries macro (mqtt-payload.md §6, proposal §6).
--
--   t_ms(i) = time.start_utc + 1000 · ( t[i]  when the series has explicit t
--                                     | t0 + i·dt  otherwise )
--
-- Because time and units travel inside the payload, this one function handles
-- every self-describing series without a protocol join and without per-device
-- branches. It explodes at query time on purpose: materializing pulse grain for
-- every experiment is what the 27 M-rows-per-3-days Grebbedijk precedent warns
-- against, so callers that need the grain hot wrap this in their own table.
--
-- v2 rows reach it through ambit_trace_v3(), which restates them in this shape.
--
--   SELECT p.* FROM enriched_experiment_raw_data r,
--   LATERAL trace_points(r.data) p WHERE r.experiment_id = :exp;
--
-- Two rules keep this bit-identical to openjii.trace.to_records():
--
--   * The branch is on the *presence* of an explicit t array, not per element. A
--     series carries exactly one time form, so when t exists it is authoritative
--     for every sample: a missing, null or non-numeric element yields NULL rather
--     than being refilled from (t0, dt), which would invent a time the payload
--     never stated. Reading t as array<string> and casting each element keeps
--     that decision element-wise instead of depending on how a whole-array cast
--     treats one bad entry.
--   * Milliseconds go through round_half_up(x, 0), the shared half-away-from-zero
--     primitive the Python helper mirrors (000_round_half_up.sql). Not round(),
--     which is decimal half-up in Spark and ties-to-even in Python, and not a bare
--     floor(x + 0.5), which rounds negative halves towards zero.
CREATE OR REPLACE FUNCTION ${catalog}.${schema}.trace_points(m VARIANT)
RETURNS TABLE (series STRING, t TIMESTAMP, value DOUBLE, unit STRING)
COMMENT 'Explode a self-describing measurement into (series, t, value, unit) (mqtt-payload.md 6).'
DETERMINISTIC
RETURN
  SELECT
    s.series_key AS series,
    timestamp_millis(
      try_cast(
        ${catalog}.${schema}.round_half_up(
          try_variant_get(o.obj, '$.time.start_utc', 'bigint')
          + 1000 * CASE
              -- explicit t: irregular cadence, or a mixed-frequency run
              WHEN try_variant_get(s.series_def, '$.t', 'array<string>') IS NOT NULL
                THEN try_cast(
                  try_element_at(
                    try_variant_get(s.series_def, '$.t', 'array<string>'),
                    e.sample_pos + 1
                  ) AS DOUBLE
                )
              -- regular (t0, dt): dt already carries tick_factor/freq
              ELSE coalesce(try_variant_get(s.series_def, '$.t0', 'double'), 0)
                     + e.sample_pos * try_variant_get(s.series_def, '$.dt', 'double')
            END,
          0
        ) AS BIGINT
      )
    ) AS t,
    e.sample_value AS value,
    try_variant_get(s.series_def, '$.u', 'string') AS unit
  FROM (SELECT ${catalog}.${schema}.measurement_object(m) AS obj) AS o,
       LATERAL variant_explode(
         coalesce(try_variant_get(o.obj, '$.series'), parse_json('{}'))
       ) AS s(series_pos, series_key, series_def),
       LATERAL posexplode(
         coalesce(
           try_variant_get(s.series_def, '$.v', 'array<double>'),
           CAST(array() AS ARRAY<DOUBLE>)
         )
       ) AS e(sample_pos, sample_value)

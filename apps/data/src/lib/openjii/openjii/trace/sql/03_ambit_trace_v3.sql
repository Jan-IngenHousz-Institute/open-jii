-- Dual-read normalizer for AMBIT traces (mqtt-payload.md §7, §8).
--
-- One input measurement object to one canonical ambit.trace/3 object, so
-- trace_points() covers the union of old and new data and history is not
-- stranded. Rows that name their own schema pass through untouched; v2 rows
-- (no `schema` key) are restated: series renamed per §5, dt reconstructed as
-- tick_factor/freq from metadata.segments, the timing tick pair folded into
-- time.duration_ms, identity mapped to sensor_id.
--
-- The v2 path is permanent, not transitional: a v3 producer intentionally falls
-- back to emitting a v2 row when identity/calibration is unavailable, so both
-- generations arrive interleaved indefinitely. One input row always yields one
-- canonical object -- rows are never merged and never duplicated.
--
-- Returns NULL for anything that is not an AMBIT trace, so callers filter on the
-- result instead of re-deriving the row taxonomy. Null members are dropped by
-- to_json (ignoreNullFields), which is exactly the contract's "omitted, never
-- null" rule.
--
-- Assumptions v2 could not state travel back in `_compat` (prefixed like the
-- pipeline's other transport-only key, _sample_encoding):
--   * tick_factor appears in no v2 payload -- only in DEVICE_INFO -- so the fleet
--     calibration value 0.854 is assumed;
--   * subsampling appears in no v2 payload either: ambient arrays shorter than
--     the pulse arrays are the only signal, and the firmware only ever means 8;
--   * a mixed-frequency run cannot be described by one (t0, dt), so the whole
--     series gets explicit t -- including the ambient channels, whose means are
--     centred inside each segment's own 8-pulse window rather than frozen to the
--     first segment's period. When that reconstruction does not account for
--     exactly the ambient values received, the series is emitted with no time
--     model at all and `_compat.ambient_time_unresolved` says so: a legacy
--     payload that cannot be dated must not be given a plausible wrong date.
--
-- All rounding goes through round_half_up()/round_half_up_array(), which are half
-- away from zero for both signs -- see 000_round_half_up.sql for why neither
-- Spark's round() nor a bare floor(x·10^d + 0.5) will do. openjii.trace applies
-- the identical rule, so a negative leaf temperature and a freq-40 timeline at
-- index 7 land on the same value and the same millisecond on both sides.
--
-- The 630 nm channels accept both v2 spellings: the canonical `s_630`/`r_630` and
-- the earlier `s_fluo`/`r_fluo` tags for the same FSM indices, canonical first so a
-- row carrying both still yields exactly one series (`_compat.legacy_fluo_alias`
-- records when the legacy tags supplied the values). Dashboards therefore never
-- branch on the vintage.
--
-- The legacy device-computed `fluo` array (dropped from the firmware in 2026-06,
-- still present in SD-card backlogs) is deliberately not carried over: it is
-- fluo_630_signal[i] / fluo_630_ref[i], recomputed downstream. Indices nobody has
-- named yet keep their arr<idx> name and the main clock (arr9..arr15 -- a bounded
-- range shared with the Python reference, because a MAP-typed series object would
-- downgrade the contract's integer counts to doubles).
CREATE OR REPLACE FUNCTION ${catalog}.${schema}.ambit_trace_v3(
  sample VARIANT,
  event_time TIMESTAMP
)
RETURNS VARIANT
COMMENT 'Normalize a v2 or v3 AMBIT trace row into one ambit.trace/3 object; NULL when the row is not a trace (mqtt-payload.md 7, 8).'
DETERMINISTIC
RETURN (
  SELECT
    CASE
      WHEN e.schema_tag LIKE 'ambit.trace/%' THEN e.obj
      WHEN e.schema_tag IS NOT NULL THEN NULL
      WHEN NOT e.is_v2_trace THEN NULL
      ELSE parse_json(to_json(named_struct(
        'schema', 'ambit.trace/3',
        'measure_id', e.measure_id,
        'channel', e.channel,
        'device', e.device,
        'sensor_id', e.sensor_id,
        'tag', e.tag,
        'time', named_struct(
          'start_utc', e.start_utc,
          'end_utc', e.end_utc,
          'duration_ms', e.duration_ms
        ),
        'protocol', named_struct(
          'name', e.protocol_name,
          'cmd', e.cmd_raw,
          'segments', e.segments,
          'cal_version', e.cal_version,
          'tick_factor', e.tick_factor,
          'gains', e.gains,
          'currents', e.currents
        ),
        'series', named_struct(
          'leaf_temp', CASE WHEN e.env IS NOT NULL THEN named_struct(
            'u', 'Cel', 't', e.env_t, 't_est', e.env_t_est,
            'v', ${catalog}.${schema}.round_half_up_array(e.env, 2)
          ) END,
          'fluo_630_signal', CASE WHEN e.s_630 IS NOT NULL THEN named_struct(
            'u', 'count', 't0', e.main_t0, 'dt', e.main_dt,
            't', slice(e.main_t, 1, coalesce(array_size(e.s_630), 0)), 'v', e.s_630
          ) END,
          'fluo_630_ref', CASE WHEN e.r_630 IS NOT NULL THEN named_struct(
            'u', 'count', 't0', e.main_t0, 'dt', e.main_dt,
            't', slice(e.main_t, 1, coalesce(array_size(e.r_630), 0)), 'v', e.r_630
          ) END,
          'refl_730_signal', CASE WHEN e.s_730 IS NOT NULL THEN named_struct(
            'u', 'count', 't0', e.main_t0, 'dt', e.main_dt,
            't', slice(e.main_t, 1, coalesce(array_size(e.s_730), 0)), 'v', e.s_730
          ) END,
          'refl_730_ref', CASE WHEN e.r_730 IS NOT NULL THEN named_struct(
            'u', 'count', 't0', e.main_t0, 'dt', e.main_dt,
            't', slice(e.main_t, 1, coalesce(array_size(e.r_730), 0)), 'v', e.r_730
          ) END,
          'ambient_sun_vis', CASE WHEN e.sun IS NOT NULL THEN named_struct(
            'u', 'count', 't0', e.amb_t0, 'dt', e.amb_dt,
            't', slice(e.amb_t, 1, coalesce(array_size(e.sun), 0)), 'v', e.sun
          ) END,
          'ambient_leaf_ir', CASE WHEN e.leaf IS NOT NULL THEN named_struct(
            'u', 'count', 't0', e.amb_t0, 'dt', e.amb_dt,
            't', slice(e.amb_t, 1, coalesce(array_size(e.leaf), 0)), 'v', e.leaf
          ) END,
          -- unnamed FSM indices: preserved on the main clock, never dropped
          'arr9', CASE WHEN e.arr9 IS NOT NULL THEN named_struct(
            'u', 'count', 't0', e.main_t0, 'dt', e.main_dt,
            't', slice(e.main_t, 1, coalesce(array_size(e.arr9), 0)), 'v', e.arr9
          ) END,
          'arr10', CASE WHEN e.arr10 IS NOT NULL THEN named_struct(
            'u', 'count', 't0', e.main_t0, 'dt', e.main_dt,
            't', slice(e.main_t, 1, coalesce(array_size(e.arr10), 0)), 'v', e.arr10
          ) END,
          'arr11', CASE WHEN e.arr11 IS NOT NULL THEN named_struct(
            'u', 'count', 't0', e.main_t0, 'dt', e.main_dt,
            't', slice(e.main_t, 1, coalesce(array_size(e.arr11), 0)), 'v', e.arr11
          ) END,
          'arr12', CASE WHEN e.arr12 IS NOT NULL THEN named_struct(
            'u', 'count', 't0', e.main_t0, 'dt', e.main_dt,
            't', slice(e.main_t, 1, coalesce(array_size(e.arr12), 0)), 'v', e.arr12
          ) END,
          'arr13', CASE WHEN e.arr13 IS NOT NULL THEN named_struct(
            'u', 'count', 't0', e.main_t0, 'dt', e.main_dt,
            't', slice(e.main_t, 1, coalesce(array_size(e.arr13), 0)), 'v', e.arr13
          ) END,
          'arr14', CASE WHEN e.arr14 IS NOT NULL THEN named_struct(
            'u', 'count', 't0', e.main_t0, 'dt', e.main_dt,
            't', slice(e.main_t, 1, coalesce(array_size(e.arr14), 0)), 'v', e.arr14
          ) END,
          'arr15', CASE WHEN e.arr15 IS NOT NULL THEN named_struct(
            'u', 'count', 't0', e.main_t0, 'dt', e.main_dt,
            't', slice(e.main_t, 1, coalesce(array_size(e.arr15), 0)), 'v', e.arr15
          ) END
        ),
        '_compat', named_struct(
          'source', 'v2',
          'tick_factor_assumed', e.tick_factor,
          'mixed_segment_frequencies', CASE WHEN e.mixed THEN true END,
          'ambient_subsampled', CASE WHEN e.subsampled THEN true END,
          'ambient_time_unresolved',
            CASE WHEN e.subsampled AND NOT e.ambient_resolved THEN true END,
          'legacy_fluo_alias', CASE WHEN e.legacy_fluo_alias THEN true END
        )
      )))
    END
  FROM (
    -- 5: the ambient descriptors, which depend on the main-clock ones
    SELECT
      f.*,
      CASE
        WHEN NOT f.subsampled THEN f.main_t0
        WHEN NOT f.ambient_resolved THEN NULL
        WHEN f.mixed THEN NULL
        ELSE ${catalog}.${schema}.round_half_up(3.5 * f.base_dt, 4)
      END AS amb_t0,
      CASE
        WHEN NOT f.subsampled THEN f.main_dt
        WHEN NOT f.ambient_resolved THEN NULL
        WHEN f.mixed THEN NULL
        ELSE ${catalog}.${schema}.round_half_up(8 * f.base_dt, 4)
      END AS amb_dt,
      CASE
        WHEN NOT f.subsampled THEN f.main_t
        WHEN NOT f.ambient_resolved THEN NULL
        WHEN f.mixed THEN f.ambient_centres
      END AS amb_t
    FROM (
      -- 4: the main-clock and leaf_temp descriptors
      SELECT
        d.*,
        CASE WHEN d.mixed THEN d.timeline END AS main_t,
        CASE WHEN NOT d.mixed AND d.base_dt IS NOT NULL THEN 0.0D END AS main_t0,
        CASE
          WHEN NOT d.mixed AND d.base_dt IS NOT NULL
            THEN ${catalog}.${schema}.round_half_up(d.base_dt, 4)
        END AS main_dt,
        CASE
          WHEN d.n_env = 0 THEN CAST(array() AS ARRAY<DOUBLE>)
          -- an idx-8-aware AMBIT behind a pre-v3 Ambyte: real offsets, in ms
          WHEN d.env_offsets_ms IS NOT NULL
            THEN ${catalog}.${schema}.round_half_up_array(
              transform(slice(d.env_offsets_ms, 1, d.n_env), x -> x / 1000.0), 4
            )
          -- otherwise the normative estimator: t[k] = k·Δ, Δ = max(2, 8/freq₁),
          -- clamped into the measured window whenever the duration is known --
          -- including a measured zero, which the formula collapses onto t = 0
          ELSE ${catalog}.${schema}.round_half_up_array(
            transform(
              sequence(0, greatest(d.n_env - 1, 0)),
              k -> k * CASE
                     WHEN d.n_env > 1 AND d.duration_ms IS NOT NULL
                      AND (d.n_env - 1) * d.env_delta0 > d.duration_ms / 1000.0
                        THEN (d.duration_ms / 1000.0) / (d.n_env - 1)
                     ELSE d.env_delta0
                   END
            ),
            4
          )
        END AS env_t,
        CASE WHEN d.env_offsets_ms IS NULL THEN true END AS env_t_est
      FROM (
        -- 3: scalars derived from the first segment, and ambient trustworthiness
        SELECT
          c.*,
          c.seg1.freq AS freq1,
          0.854 / nullif(c.seg1.freq, 0) AS base_dt,
          greatest(2.0D, coalesce(8.0 / nullif(c.seg1.freq, 0), 2.0D)) AS env_delta0,
          coalesce(array_size(c.ambient_centres), 0) > 0
            AND coalesce(array_size(c.ambient_centres), 0) = c.ambient_len AS ambient_resolved
        FROM (
          -- 2: run shape, the multi-segment timeline, the ambient window centres
          SELECT
            b.*,
            try_element_at(b.segments, 1) AS seg1,
            coalesce(
              array_size(
                array_distinct(filter(transform(b.segments, x -> x.freq), f -> f IS NOT NULL))
              ),
              0
            ) > 1 AS mixed,
            coalesce(array_size(b.env), 0) AS n_env,
            greatest(coalesce(array_size(b.sun), 0), coalesce(array_size(b.leaf), 0))
              AS ambient_len,
            greatest(coalesce(array_size(b.sun), 0), coalesce(array_size(b.leaf), 0)) > 0
              AND greatest(coalesce(array_size(b.sun), 0), coalesce(array_size(b.leaf), 0))
                  < greatest(
                      coalesce(array_size(b.s_630), 0), coalesce(array_size(b.r_630), 0),
                      coalesce(array_size(b.s_730), 0), coalesce(array_size(b.r_730), 0)
                    ) AS subsampled,
            -- segment k+1 continues segment k's timeline at t0 + n_k·dt_k
            ${catalog}.${schema}.round_half_up_array(flatten(transform(
              b.segments,
              (seg, i) -> CASE
                WHEN coalesce(seg.pulses, 0) > 0 AND coalesce(seg.freq, 0) > 0
                  THEN transform(
                    sequence(0, greatest(seg.pulses - 1, 0)),
                    j -> aggregate(
                      slice(b.segments, 1, i),
                      0.0D,
                      (acc, p) ->
                        acc + coalesce(coalesce(p.pulses, 0) * (0.854 / nullif(p.freq, 0)), 0.0D)
                    ) + j * (0.854 / seg.freq)
                  )
                ELSE CAST(array() AS ARRAY<DOUBLE>)
              END
            )), 4) AS timeline,
            -- one centre per 8-pulse mean, on the clock of the segment it belongs
            -- to; a trailing partial window is centred on what it actually holds
            ${catalog}.${schema}.round_half_up_array(flatten(transform(
              b.segments,
              (seg, i) -> CASE
                WHEN coalesce(seg.pulses, 0) > 0 AND coalesce(seg.freq, 0) > 0
                  THEN transform(
                    sequence(0, greatest(CAST(ceil(seg.pulses / 8.0) AS INT) - 1, 0)),
                    w -> aggregate(
                      slice(b.segments, 1, i),
                      0.0D,
                      (acc, p) ->
                        acc + coalesce(coalesce(p.pulses, 0) * (0.854 / nullif(p.freq, 0)), 0.0D)
                    )
                    + (w * 8 + (least(8, seg.pulses - w * 8) - 1) / 2.0)
                      * (0.854 / seg.freq)
                  )
                ELSE CAST(array() AS ARRAY<DOUBLE>)
              END
            )), 4) AS ambient_centres
          FROM (
            -- 1: the measurement object and its v2 members
            SELECT
              a.obj,
              try_variant_get(a.obj, '$.schema', 'string') AS schema_tag,
              try_variant_get(a.obj, '$.measure_id', 'bigint') AS measure_id,
              try_variant_get(a.obj, '$.channel', 'string') AS channel,
              try_variant_get(a.obj, '$.device', 'string') AS device,
              try_variant_get(a.obj, '$.tag', 'string') AS tag,
              try_variant_get(a.obj, '$.cmd_raw', 'string') AS cmd_raw,
              -- first present v2 identity spelling wins (§8)
              coalesce(
                try_variant_get(a.obj, '$.metadata.sensor_id', 'string'),
                try_variant_get(a.obj, '$.metadata.device_id', 'string'),
                try_variant_get(a.obj, '$.metadata.deviceID', 'string')
              ) AS sensor_id,
              try_variant_get(a.obj, '$.metadata.protocol', 'string') AS protocol_name,
              ${catalog}.${schema}.cal_version_hex8(
                try_variant_get(a.obj, '$.metadata.cal_version', 'string')
              ) AS cal_version,
              try_variant_get(a.obj, '$.metadata.gains', 'array<bigint>') AS gains,
              try_variant_get(a.obj, '$.metadata.currents', 'array<bigint>') AS currents,
              try_variant_get(
                a.obj, '$.metadata.segments',
                'array<struct<pulses:int,freq:double,actinic:int>>'
              ) AS segments,
              coalesce(
                try_variant_get(a.obj, '$.startTicks_UTC', 'bigint'),
                try_variant_get(a.obj, '$.startTicks', 'bigint'),
                unix_millis(event_time)
              ) AS start_utc,
              coalesce(
                try_variant_get(a.obj, '$.endTicks_UTC', 'bigint'),
                try_variant_get(a.obj, '$.endTicks', 'bigint')
              ) AS end_utc,
              -- idx 7 is a µs tick pair truncated to uint32 on the wire, so it
              -- wraps every 71.6 min; the difference modulo 2^32 is the run length
              try_cast(${catalog}.${schema}.round_half_up(
                mod(
                  try_element_at(try_variant_get(a.obj, '$.data.timing', 'array<bigint>'), 2)
                    - try_element_at(try_variant_get(a.obj, '$.data.timing', 'array<bigint>'), 1)
                    + 4294967296,
                  4294967296
                ) / 1000.0,
                0
              ) AS BIGINT) AS duration_ms,
              0.854D AS tick_factor,
              try_variant_get(a.obj, '$.data.env', 'array<double>') AS env,
              try_variant_get(a.obj, '$.data.arr8', 'array<double>') AS env_offsets_ms,
              -- FSM idx 1/2 were tagged s_fluo/r_fluo before the rename to
              -- s_630/r_630: same indices, same 630 nm channels. Canonical spelling
              -- first, legacy second, so a row carrying both yields one series.
              coalesce(
                try_variant_get(a.obj, '$.data.s_630', 'array<bigint>'),
                try_variant_get(a.obj, '$.data.s_fluo', 'array<bigint>')
              ) AS s_630,
              coalesce(
                try_variant_get(a.obj, '$.data.r_630', 'array<bigint>'),
                try_variant_get(a.obj, '$.data.r_fluo', 'array<bigint>')
              ) AS r_630,
              (
                (
                  try_variant_get(a.obj, '$.data.s_630') IS NULL
                  AND try_variant_get(a.obj, '$.data.s_fluo') IS NOT NULL
                )
                OR (
                  try_variant_get(a.obj, '$.data.r_630') IS NULL
                  AND try_variant_get(a.obj, '$.data.r_fluo') IS NOT NULL
                )
              ) AS legacy_fluo_alias,
              try_variant_get(a.obj, '$.data.s_730', 'array<bigint>') AS s_730,
              try_variant_get(a.obj, '$.data.r_730', 'array<bigint>') AS r_730,
              try_variant_get(a.obj, '$.data.sun', 'array<bigint>') AS sun,
              try_variant_get(a.obj, '$.data.leaf', 'array<bigint>') AS leaf,
              try_variant_get(a.obj, '$.data.arr9', 'array<bigint>') AS arr9,
              try_variant_get(a.obj, '$.data.arr10', 'array<bigint>') AS arr10,
              try_variant_get(a.obj, '$.data.arr11', 'array<bigint>') AS arr11,
              try_variant_get(a.obj, '$.data.arr12', 'array<bigint>') AS arr12,
              try_variant_get(a.obj, '$.data.arr13', 'array<bigint>') AS arr13,
              try_variant_get(a.obj, '$.data.arr14', 'array<bigint>') AS arr14,
              try_variant_get(a.obj, '$.data.arr15', 'array<bigint>') AS arr15,
              (
                coalesce(try_variant_get(a.obj, '$.cmd_raw', 'string') LIKE 'arrun%', false)
                OR try_variant_get(a.obj, '$.data.env') IS NOT NULL
                OR try_variant_get(a.obj, '$.data.s_630') IS NOT NULL
                OR try_variant_get(a.obj, '$.data.r_630') IS NOT NULL
                OR try_variant_get(a.obj, '$.data.s_fluo') IS NOT NULL
                OR try_variant_get(a.obj, '$.data.r_fluo') IS NOT NULL
                OR try_variant_get(a.obj, '$.data.sun') IS NOT NULL
                OR try_variant_get(a.obj, '$.data.leaf') IS NOT NULL
                OR try_variant_get(a.obj, '$.data.s_730') IS NOT NULL
                OR try_variant_get(a.obj, '$.data.r_730') IS NOT NULL
              ) AS is_v2_trace
            FROM (SELECT ${catalog}.${schema}.measurement_object(sample) AS obj) AS a
          ) AS b
        ) AS c
      ) AS d
    ) AS f
  ) AS e
)

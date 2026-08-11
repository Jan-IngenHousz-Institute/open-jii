"""The normative rules of the v3 payload contract (ambyte-iot docs/mqtt-payload.md)."""

from __future__ import annotations

import pytest
from openjii.trace.contract import (
    V2_TICK_FACTOR,
    V2_UNKNOWN_ARRAY_RANGE,
    ambient_window_centres,
    estimate_env_offsets,
    is_trace,
    round2,
    round4,
    round_half_up,
    round_to,
    segment_timeline,
    series_offsets,
    unwrap_measurement,
    wrap_safe_duration_ms,
)


class TestUnwrapMeasurement:
    def test_unwraps_the_one_element_sample_array(self) -> None:
        assert unwrap_measurement([{"schema": "ambit.trace/3"}]) == {"schema": "ambit.trace/3"}

    def test_leaves_an_object_alone(self) -> None:
        assert unwrap_measurement({"schema": "ambit.trace/3"}) == {"schema": "ambit.trace/3"}

    def test_leaves_a_longer_array_alone(self) -> None:
        # Out of contract, and keeping only the head would silently lose data.
        assert unwrap_measurement([{"a": 1}, {"a": 2}]) == [{"a": 1}, {"a": 2}]

    def test_leaves_an_empty_array_alone(self) -> None:
        assert unwrap_measurement([]) == []


class TestIsTrace:
    def test_v3_trace_family(self) -> None:
        assert is_trace({"schema": "ambit.trace/3"})
        assert is_trace({"schema": "ambit.trace/4"})

    def test_other_v3_families_are_not_traces(self) -> None:
        assert not is_trace({"schema": "ambyte.telemetry/1"})
        assert not is_trace({"schema": "ambit.device/1"})

    def test_v2_recognized_by_command_or_series_keys(self) -> None:
        assert is_trace({"cmd_raw": "arrun 1,0,2"})
        assert is_trace({"data": {"s_630": [1, 2]}})
        assert not is_trace({"cmd_raw": "get_info", "data": {"fw": "0.1.0"}})

    def test_non_objects(self) -> None:
        assert not is_trace(None)
        assert not is_trace([{"schema": "ambit.trace/3"}])


class TestWrapSafeDuration:
    def test_plain_difference(self) -> None:
        assert wrap_safe_duration_ms([1_000_000, 11_250_000]) == 10_250

    def test_uint32_wrap(self) -> None:
        # esp_timer_get_time() truncated to uint32 wraps every 71.6 min.
        assert wrap_safe_duration_ms([4_294_000_000, 1_000_000]) == 1_967

    def test_missing_or_short(self) -> None:
        assert wrap_safe_duration_ms(None) is None
        assert wrap_safe_duration_ms([1_000_000]) is None


class TestEstimateEnvOffsets:
    def test_cadence_model_when_it_fits_the_window(self) -> None:
        # Δ = max(2, 8/freq₁) = 8 s, and 2·8 fits inside a 30 s run.
        assert estimate_env_offsets(3, 1, 30.0) == [0.0, 8.0, 16.0]

    def test_clamped_into_the_measured_window(self) -> None:
        # 2·8 = 16 s overshoots a 10.25 s run, so Δ becomes 10.25/2.
        assert estimate_env_offsets(3, 1, 10.25) == [0.0, 5.125, 10.25]

    def test_two_second_floor(self) -> None:
        # 8/freq below the 2000 ms gate does not speed the cadence up.
        assert estimate_env_offsets(3, 100, 30.0) == [0.0, 2.0, 4.0]

    def test_single_sample_runs(self) -> None:
        # Runs ineligible for in-run env sampling produce one sample at t = 0.
        assert estimate_env_offsets(1, 1, 30.0) == [0.0]

    def test_no_samples(self) -> None:
        assert estimate_env_offsets(0, 1, 30.0) == []

    def test_unknown_frequency_falls_back_to_the_floor(self) -> None:
        assert estimate_env_offsets(2, None, None) == [0.0, 2.0]

    def test_no_duration_means_no_clamp(self) -> None:
        # An unknown duration cannot contradict the cadence model.
        assert estimate_env_offsets(3, 1, None) == [0.0, 8.0, 16.0]

    def test_zero_duration_clamps_onto_the_run_start(self) -> None:
        # The formula is applied literally: a measured zero window collapses
        # every offset onto t = 0 rather than being treated as "no duration".
        assert estimate_env_offsets(3, 1, 0.0) == [0.0, 0.0, 0.0]


class TestSegmentTimeline:
    def test_single_segment(self) -> None:
        assert segment_timeline([{"pulses": 3, "freq": 1}]) == [0.0, 0.854, 1.708]

    def test_segment_continues_the_previous_timeline(self) -> None:
        # Segment k+1 starts at segment k's t0 + n_k·dt_k.
        assert segment_timeline([{"pulses": 3, "freq": 1}, {"pulses": 3, "freq": 2}]) == [
            0.0,
            0.854,
            1.708,
            2.562,
            2.989,
            3.416,
        ]

    def test_zero_pulse_and_frequencyless_segments(self) -> None:
        assert segment_timeline([{"pulses": 0, "freq": 1}, {"pulses": 2, "freq": 1}]) == [
            0.0,
            0.854,
        ]
        assert segment_timeline([{"pulses": 2}]) == []

    def test_no_segments(self) -> None:
        assert segment_timeline([]) == []


class TestAmbientWindowCentres:
    def test_single_segment_matches_the_contract_regular_form(self) -> None:
        # t0 = 3.5·dt, then every 8·dt: the same numbers the regular form encodes.
        assert ambient_window_centres([{"pulses": 16, "freq": 1}]) == [2.989, 9.821]

    def test_later_segments_keep_their_own_period(self) -> None:
        # 8 pulses at 1 Hz then 8 at 2 Hz: the second mean is centred at
        # 8·0.854 + 3.5·(0.854/2) = 8.3265 s, not at the first segment's 9.821 s.
        assert ambient_window_centres([{"pulses": 8, "freq": 1}, {"pulses": 8, "freq": 2}]) == [2.989, 8.3265]

    def test_trailing_partial_window_is_centred_on_what_it_holds(self) -> None:
        # 20 pulses: two full windows plus a 4-pulse remainder at 16+1.5 ticks.
        assert ambient_window_centres([{"pulses": 20, "freq": 1}]) == [2.989, 9.821, 14.945]

    def test_segments_without_a_frequency_contribute_nothing(self) -> None:
        assert ambient_window_centres([{"pulses": 8}]) == []
        assert ambient_window_centres([]) == []


class TestSeriesOffsets:
    def test_regular_form(self) -> None:
        assert series_offsets({"t0": 0, "dt": 0.854, "v": [1, 2, 3]}) == pytest.approx([0.0, 0.854, 1.708])

    def test_regular_form_with_offset_start(self) -> None:
        # Subsampled ambient: centre of the 8-pulse window.
        assert series_offsets({"t0": 2.989, "dt": 6.832, "v": [1, 2]}) == pytest.approx([2.989, 9.821])

    def test_regular_offsets_are_not_rerounded(self) -> None:
        # The 4-decimal rendering is a producer rule applied when t/t0/dt are
        # emitted. Re-rounding here would move a timestamp relative to the SQL
        # macro, which reads the emitted numbers as they are.
        assert series_offsets({"t0": 0, "dt": 0.02135, "v": [1, 1]})[1] == 0.02135

    def test_explicit_form_wins(self) -> None:
        assert series_offsets({"t": [0.0, 8.6], "t0": 0, "dt": 99, "v": [1, 2]}) == [0.0, 8.6]

    def test_explicit_form_shorter_than_the_values(self) -> None:
        # Authoritative for every sample: the missing element is NULL, not t0+i·dt.
        assert series_offsets({"t": [0.0], "v": [1, 2]}) == [0.0, None]

    def test_explicit_form_with_a_null_element(self) -> None:
        assert series_offsets({"t": [0.0, None, 1.0], "v": [1, 2, 3]}) == [0.0, None, 1.0]

    def test_explicit_form_with_a_non_numeric_element(self) -> None:
        assert series_offsets({"t": [0.0, "later"], "v": [1, 2]}) == [0.0, None]

    def test_explicit_form_beside_a_regular_one_still_wins(self) -> None:
        # The exact divergence a per-element coalesce would reintroduce: 2 s here
        # in SQL and None in Python.
        assert series_offsets({"t": [0.0], "t0": 0, "dt": 2, "v": [1, 2]}) == [0.0, None]

    def test_explicit_form_that_is_not_an_array(self) -> None:
        assert series_offsets({"t": 5, "t0": 0, "dt": 2, "v": [1, 2]}) == pytest.approx([0.0, 2.0])

    def test_neither_form(self) -> None:
        assert series_offsets({"u": "count", "v": [1, 2]}) == [None, None]


class TestRounding:
    @pytest.mark.parametrize(("value", "expected"), [(0.4, 0), (0.5, 1), (1.5, 2), (2.5, 3), (-0.5, -1)])
    def test_halves_go_away_from_zero(self, value: float, expected: int) -> None:
        # SQL round() rounds halves up; Python's built-in rounds to even.
        assert round_half_up(value) == expected

    def test_round4_is_half_up_where_pythons_round_is_not(self) -> None:
        # 0.14945 is a freq-40 timeline at index 7: ties-to-even gives 0.1494
        # (149 ms) and the contract's %.4f gives 0.1495 (150 ms).
        assert round4(0.14945) == 0.1495
        assert round(0.14945, 4) == 0.1494

    def test_round4_matches_the_sql_scaled_expression(self) -> None:
        # floor(x * 10000 + 0.5) / 10000 -- the same double operations, in the
        # same order, as the SQL. Not a decimal library rounding mode.
        import math

        for value in (0.0, 0.02135, 0.14945, 0.854, 2.989, 8.3265, 12.809999999999999):
            assert round4(value) == math.floor(value * 10000 + 0.5) / 10000

    def test_round2_renders_leaf_temperatures(self) -> None:
        assert round2(25.004) == 25.0
        assert round2(24.605) == 24.61

    def test_round_to_is_the_shared_primitive(self) -> None:
        assert round4(1.23456) == round_to(1.23456, 4)
        assert round2(1.235) == round_to(1.235, 2)


def test_unknown_array_preservation_range_is_shared_and_skips_arr8() -> None:
    # arr8 is consumed as leaf_temp's device offsets, so it is not a series; the
    # bounded range is what the SQL compat struct enumerates.
    assert 8 not in V2_UNKNOWN_ARRAY_RANGE
    assert list(V2_UNKNOWN_ARRAY_RANGE) == [9, 10, 11, 12, 13, 14, 15]


def test_tick_factor_is_the_documented_calibration_value() -> None:
    # The 0.854 correction is finally in the payload rather than a demo notebook;
    # this is the value the v2 compat path has to assume.
    assert V2_TICK_FACTOR == 0.854

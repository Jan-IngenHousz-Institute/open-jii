"""v2 -> v3 normalization and the timeseries rule, driven by the shipped fixtures.

The same fixtures and the same expectations run against the SQL in the
``centrum_v3_smoke`` task; this side needs no warehouse.
"""

from __future__ import annotations

from typing import ClassVar

import pytest
from openjii.trace import fixtures, normalize_trace, to_records
from openjii.trace.normalize import cal_version_hex8

TRACES = fixtures.load(fixtures.TRACES)
TRACE_IDS = [f["name"] for f in TRACES]


def _points_by_index(records: list[dict]) -> dict[tuple[str, int], dict]:
    """Index flat records by (series, position within that series)."""
    counters: dict[str, int] = {}
    indexed: dict[tuple[str, int], dict] = {}
    for record in records:
        position = counters.get(record["series"], 0)
        counters[record["series"]] = position + 1
        indexed[(record["series"], position)] = record
    return indexed


@pytest.mark.parametrize("fixture", TRACES, ids=TRACE_IDS)
def test_expected_points(fixture: dict) -> None:
    expect = fixture["expect"]
    records = to_records(fixture["sample"])

    if expect.get("normalized_is_null"):
        assert records == []
        return

    assert len(records) == expect["point_count"]
    indexed = _points_by_index(records)
    for expected in expect["points"]:
        record = indexed[(expected["series"], expected["index"])]
        if expected["t_ms"] is None:
            # A malformed or undatable series states no time, and none is invented.
            assert record["t"] is None
        else:
            assert record["t"] is not None
            assert round(record["t"].timestamp() * 1000) == expected["t_ms"]
        assert record["value"] == pytest.approx(expected["value"])
        assert record["unit"] == expected["unit"]


def test_zero_duration_collapses_every_env_sample() -> None:
    zero_duration = [f for f in TRACES if f["expect"].get("leaf_temp_collapses_to_one_millisecond")]
    assert zero_duration, "the shared fixtures must cover a measured zero duration"
    for fixture in zero_duration:
        instants = {
            record["t"] for record in to_records(fixture["sample"]) if record["series"] == "leaf_temp"
        }
        assert len(instants) == 1, f"{fixture['name']}: every env sample sits at the run start"
        assert None not in instants


@pytest.mark.parametrize("fixture", TRACES, ids=TRACE_IDS)
def test_normalized_shape(fixture: dict) -> None:
    expect = fixture["expect"]
    trace = normalize_trace(fixture["sample"])

    if expect.get("normalized_is_null"):
        assert trace is None
        return

    assert trace is not None
    assert trace["schema"] == "ambit.trace/3"
    # Null members are omitted, never null (contract §5).
    assert all(value is not None for value in trace.values())

    expected = expect.get("normalized")
    if not expected:
        return

    series = trace["series"]
    if "sensor_id" in expected:
        if expected["sensor_id"] is None:
            # No identity in any spelling: omitted, and the human name is not
            # substituted for it.
            assert "sensor_id" not in trace
        else:
            assert trace["sensor_id"] == expected["sensor_id"]
    if "cal_version" in expected:
        assert trace["protocol"]["cal_version"] == expected["cal_version"]
    if "duration_ms" in expected:
        assert trace["time"]["duration_ms"] == expected["duration_ms"]
    if "tick_factor" in expected:
        assert trace["protocol"]["tick_factor"] == expected["tick_factor"]
    if "leaf_temp_t" in expected:
        assert series["leaf_temp"]["t"] == expected["leaf_temp_t"]
    if "leaf_temp_v" in expected:
        # Half away from zero on both signs: -24.605 -> -24.61, not -24.60.
        assert series["leaf_temp"]["v"] == expected["leaf_temp_v"]
    if "main_dt" in expected:
        assert series["fluo_630_signal"]["dt"] == expected["main_dt"]
        assert series["fluo_630_signal"]["t0"] == expected["main_t0"]
    if "main_t" in expected:
        assert series["fluo_630_signal"]["t"] == expected["main_t"]
        assert "dt" not in series["fluo_630_signal"]
    if "ambient_t0" in expected:
        assert series["ambient_sun_vis"]["t0"] == expected["ambient_t0"]
        assert series["ambient_sun_vis"]["dt"] == expected["ambient_dt"]
    if "ambient_t" in expected:
        # Each mean centred in its own segment's window, not the first segment's.
        assert series["ambient_sun_vis"]["t"] == expected["ambient_t"]
        assert series["ambient_leaf_ir"]["t"] == expected["ambient_t"]
        assert "dt" not in series["ambient_sun_vis"]
    if expected.get("ambient_has_no_time"):
        assert set(series["ambient_sun_vis"]) == {"u", "v"}
    if expected.get("ambient_time_unresolved"):
        assert trace["_compat"]["ambient_time_unresolved"] is True
    if "series_names" in expected:
        assert sorted(series) == sorted(expected["series_names"])
    if "fluo_signal_v" in expected:
        # Both v2 spellings land on one canonical series, values intact.
        assert series["fluo_630_signal"]["v"] == expected["fluo_signal_v"]
        assert series["fluo_630_ref"]["v"] == expected["fluo_ref_v"]
    if "legacy_fluo_alias" in expected:
        if expected["legacy_fluo_alias"]:
            assert trace["_compat"]["legacy_fluo_alias"] is True
        else:
            assert "legacy_fluo_alias" not in trace["_compat"]
    for name, descriptor in expected.get("unknown_series", {}).items():
        assert {k: v for k, v in series[name].items() if k != "v"} == descriptor
    if expected.get("mixed_segment_frequencies"):
        assert trace["_compat"]["mixed_segment_frequencies"] is True
    if expected.get("ambient_subsampled"):
        assert trace["_compat"]["ambient_subsampled"] is True


def test_v3_rows_pass_through_untouched() -> None:
    fixture = fixtures.by_name(TRACES, "v3_regular")
    assert normalize_trace(fixture["sample"]) == fixture["sample"][0]


def test_v2_series_are_renamed_and_the_legacy_ratio_is_not_carried_over() -> None:
    fixture = fixtures.by_name(TRACES, "v2_regular_t_est")
    trace = normalize_trace(fixture["sample"])
    assert trace is not None
    assert set(trace["series"]) == {
        "leaf_temp",
        "fluo_630_signal",
        "fluo_630_ref",
        "ambient_sun_vis",
        "ambient_leaf_ir",
    }
    assert "fluo" not in trace["series"]
    assert "timing" not in trace["series"]


def test_v2_row_uses_the_envelope_time_when_the_payload_has_none() -> None:
    sample = [{"v": 2, "cmd_raw": "arrun 1,0", "data": {"s_630": [1]}}]
    trace = normalize_trace(sample, event_time_ms=1785965160359)
    assert trace is not None
    assert trace["time"]["start_utc"] == 1785965160359


def test_v2_identity_spelling_precedence() -> None:
    base = {"v": 2, "cmd_raw": "arrun 1,0", "data": {"s_630": [1]}}

    def normalized(metadata: dict, **extra) -> dict:
        trace = normalize_trace([{**base, "metadata": metadata, **extra}])
        assert trace is not None
        return trace

    assert normalized({"sensor_id": "A", "device_id": "B", "deviceID": "C"})["sensor_id"] == "A"
    assert normalized({"device_id": "B", "deviceID": "C"})["sensor_id"] == "B"
    assert normalized({"deviceID": "C"})["sensor_id"] == "C"
    # A v2 row with none is a genuine legacy exception: no sensor_id at all,
    # and the non-unique `device` name must not stand in for it.
    assert "sensor_id" not in normalized({}, device="AmbitV003")


class TestLegacyFluoVintage:
    """FSM idx 1/2 were s_fluo/r_fluo before the rename; one interface for T6."""

    BASE: ClassVar[dict] = {
        "v": 2,
        "measure_id": 1,
        "startTicks_UTC": 1785965160359,
        "cmd_raw": "arrun 1,0,2,0,0,2,0,1,0,1",
        "metadata": {"segments": [{"pulses": 2, "freq": 1, "actinic": 0}]},
    }

    def normalized(self, data: dict) -> dict:
        trace = normalize_trace([{**self.BASE, "data": data}])
        assert trace is not None
        return trace

    def test_legacy_only_row_is_recognized_as_a_trace(self) -> None:
        # Before this, a legacy-vintage row normalized to nothing at all.
        from openjii.trace import is_trace

        assert is_trace({"data": {"s_fluo": [1, 2]}})
        assert is_trace({"data": {"r_fluo": [1, 2]}})

    def test_legacy_tags_map_to_the_canonical_series(self) -> None:
        trace = self.normalized({"s_fluo": [1, 2], "r_fluo": [3, 4]})
        assert sorted(trace["series"]) == ["fluo_630_ref", "fluo_630_signal"]
        assert trace["series"]["fluo_630_signal"]["v"] == [1, 2]
        assert trace["series"]["fluo_630_ref"]["v"] == [3, 4]
        # No alias key survives into the canonical object.
        assert "s_fluo" not in trace["series"]
        assert "r_fluo" not in trace["series"]

    def test_the_vintage_is_recorded_not_hidden(self) -> None:
        assert self.normalized({"s_fluo": [1, 2]})["_compat"]["legacy_fluo_alias"] is True
        assert "legacy_fluo_alias" not in self.normalized({"s_630": [1, 2]})["_compat"]

    def test_canonical_wins_deterministically_when_both_are_present(self) -> None:
        trace = self.normalized({"s_630": [1, 2], "s_fluo": [9, 9], "r_630": [3, 4], "r_fluo": [8, 8]})
        assert trace["series"]["fluo_630_signal"]["v"] == [1, 2]
        assert trace["series"]["fluo_630_ref"]["v"] == [3, 4]
        # One input row, one canonical object, one series per channel.
        assert len(trace["series"]) == 2
        assert "legacy_fluo_alias" not in trace["_compat"]

    def test_a_mixed_vintage_row_resolves_each_channel_independently(self) -> None:
        # Canonical signal, legacy reference: both channels present exactly once.
        trace = self.normalized({"s_630": [1, 2], "r_fluo": [3, 4]})
        assert trace["series"]["fluo_630_signal"]["v"] == [1, 2]
        assert trace["series"]["fluo_630_ref"]["v"] == [3, 4]
        assert trace["_compat"]["legacy_fluo_alias"] is True

    def test_the_legacy_vintage_shares_the_main_clock(self) -> None:
        trace = self.normalized({"s_fluo": [1, 2], "timing": [0, 1708000]})
        assert trace["series"]["fluo_630_signal"]["dt"] == 0.854
        assert trace["series"]["fluo_630_signal"]["t0"] == 0.0

    def test_the_derived_fluo_ratio_is_still_not_a_series(self) -> None:
        # `fluo` was the device-computed ratio, a different thing from s_fluo.
        trace = self.normalized({"s_fluo": [1, 2], "fluo": [0.5, 0.5]})
        assert sorted(trace["series"]) == ["fluo_630_signal"]

    def test_subsampling_detection_sees_the_legacy_arrays(self) -> None:
        # main_len must count the legacy spelling, or ambient subsampling on a
        # legacy row would go undetected.
        trace = self.normalized(
            {"s_fluo": list(range(16)), "sun": [1, 2], "timing": [0, 13664000], "metadata": None}
        )
        assert trace["_compat"]["ambient_subsampled"] is True


class TestCalVersionHex8:
    def test_hex_string_is_lowercased(self) -> None:
        assert cal_version_hex8("6A4356A8") == "6a4356a8"

    def test_unsigned_crc32_becomes_padded_hex(self) -> None:
        assert cal_version_hex8(3735928559) == "deadbeef"
        assert cal_version_hex8(255) == "000000ff"

    def test_eight_digits_resolve_as_hex(self) -> None:
        # Ambiguous by construction; the contract states the hex rule first.
        assert cal_version_hex8("12345678") == "12345678"

    def test_missing(self) -> None:
        assert cal_version_hex8(None) is None
        assert cal_version_hex8("  ") is None

"""v2 -> v3 trace normalization (contract §7, §8).

Reference implementation of what the ``ambit_trace_v3`` SQL function does in
the warehouse: one input measurement object to one canonical ``ambit.trace/3``
object, so a single time model covers the union of old and new data.

Rows that already name their schema pass through untouched.
"""

from __future__ import annotations

import re
from typing import Any

from .contract import (
    AMBIENT_SUBSAMPLE_CENTRE,
    AMBIENT_SUBSAMPLE_FACTOR,
    AMBIENT_V2_KEYS,
    MAIN_CLOCK_V2_KEYS,
    SERIES_BY_V2_KEY,
    SERIES_UNITS,
    TRACE_SCHEMA,
    V2_ENV_OFFSET_KEY,
    V2_LEGACY_FLUO_KEYS,
    V2_MAIN_CLOCK_PRECEDENCE,
    V2_TICK_FACTOR,
    V2_UNKNOWN_ARRAY_KEY,
    V2_UNKNOWN_ARRAY_RANGE,
    ambient_window_centres,
    estimate_env_offsets,
    is_self_identifying,
    is_trace,
    round2,
    round4,
    segment_timeline,
    unwrap_measurement,
    wrap_safe_duration_ms,
)

_HEX8 = re.compile(r"\A[0-9a-fA-F]{8}\Z")
_DIGITS = re.compile(r"\A[0-9]+\Z")

# v2 spelled the AMBIT identity three ways over time; first present wins.
_SENSOR_ID_KEYS = ("sensor_id", "device_id", "deviceID")


def cal_version_hex8(value: Any) -> str | None:
    """Normalize a v2 ``cal_version`` to eight lowercase hex digits (§11.3).

    An eight-digit hex string is preserved (lowercased); an unsigned CRC32
    integer becomes left-padded base-16. Eight decimal digits are ambiguous and
    resolve as hex, matching the order the contract states the rules in.
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if _HEX8.match(text):
        return text.lower()
    if _DIGITS.match(text):
        return format(int(text), "08x")
    return text.lower()


def _number(value: Any) -> float | int | None:
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def _array(data: dict, key: str) -> list | None:
    value = data.get(key)
    return value if isinstance(value, list) else None


def _regular(t0: float, dt: float, unit: str, values: list) -> dict:
    return {"u": unit, "t0": round4(t0), "dt": round4(dt), "v": values}


def _explicit(offsets: list[float], unit: str, values: list) -> dict:
    return {"u": unit, "t": offsets[: len(values)], "v": values}


def _unknown_array_keys(data: dict) -> list[str]:
    """v2 keys for FSM indices nobody has named yet, in index order.

    ``arr8`` is excluded: it is consumed as leaf_temp's device-recorded offsets.
    Indices outside the shared preservation range are left out so the Python and
    SQL compat paths carry exactly the same set (see V2_UNKNOWN_ARRAY_RANGE).
    """
    found: list[tuple[int, str]] = []
    for key in data:
        match = V2_UNKNOWN_ARRAY_KEY.match(key) if isinstance(key, str) else None
        if match and int(match.group(1)) in V2_UNKNOWN_ARRAY_RANGE:
            found.append((int(match.group(1)), key))
    return [key for _, key in sorted(found)]


def normalize_trace(
    sample: Any,
    event_time_ms: int | None = None,
    tick_factor: float = V2_TICK_FACTOR,
) -> dict | None:
    """Return the ``ambit.trace/3`` object for a v2 or v3 measurement.

    Returns ``None`` when the row is not an AMBIT trace at all, mirroring the
    SQL function so callers can filter on the result.

    ``event_time_ms`` is the row's envelope time, used only when a v2 row
    carries neither ``startTicks_UTC`` nor ``startTicks``.
    """
    obj = unwrap_measurement(sample)
    if not is_trace(obj):
        return None
    if is_self_identifying(obj):
        return obj

    data = obj.get("data") if isinstance(obj.get("data"), dict) else {}
    meta = obj.get("metadata") if isinstance(obj.get("metadata"), dict) else {}

    start_utc = _number(obj.get("startTicks_UTC"))
    if start_utc is None:
        start_utc = _number(obj.get("startTicks"))
    if start_utc is None:
        start_utc = event_time_ms
    end_utc = _number(obj.get("endTicks_UTC"))
    if end_utc is None:
        end_utc = _number(obj.get("endTicks"))

    duration_ms = wrap_safe_duration_ms(data.get("timing"))

    segments = [s for s in (meta.get("segments") or []) if isinstance(s, dict)]
    freqs = [s.get("freq") for s in segments]
    freq1 = freqs[0] if freqs else None
    mixed = len({f for f in freqs if f}) > 1
    base_dt = tick_factor / float(freq1) if freq1 else None

    main_lengths = [len(a) for a in (_array(data, k) for k in MAIN_CLOCK_V2_KEYS) if a is not None]
    main_len = max(main_lengths) if main_lengths else 0
    ambient_lengths = [len(a) for a in (_array(data, k) for k in AMBIENT_V2_KEYS) if a is not None]
    ambient_len = max(ambient_lengths) if ambient_lengths else 0
    # Subsampling is not in the v2 payload; a shorter ambient array than the
    # pulse arrays is the only signal, and the firmware only ever means 8.
    subsampled = 0 < ambient_len < main_len

    timeline = segment_timeline(segments, tick_factor) if mixed else []
    # Every ambient mean sits at the centre of its own 8-pulse window on its own
    # segment's clock. When that reconstruction does not account for exactly the
    # values received, the legacy payload is not sufficient to date them and no
    # canonical timestamp is emitted rather than a plausible wrong one.
    ambient_centres = ambient_window_centres(segments, tick_factor) if subsampled else []
    ambient_resolved = bool(ambient_centres) and len(ambient_centres) == ambient_len

    series: dict[str, dict] = {}

    env = _array(data, "env")
    if env is not None:
        recorded = _array(data, V2_ENV_OFFSET_KEY)
        leaf_temp: dict[str, Any] = {"u": SERIES_UNITS["leaf_temp"]}
        if recorded is not None:
            # idx-8-aware AMBIT behind a pre-v3 Ambyte: real device offsets in ms.
            leaf_temp["t"] = [
                round4(float(x) / 1000.0) if _number(x) is not None else None for x in recorded[: len(env)]
            ]
        else:
            leaf_temp["t"] = estimate_env_offsets(
                len(env),
                freq1,
                (duration_ms / 1000.0) if duration_ms is not None else None,
            )
            leaf_temp["t_est"] = True
        leaf_temp["v"] = [round2(float(x)) if _number(x) is not None else None for x in env]
        series["leaf_temp"] = leaf_temp

    def main_clock_series(name: str, values: list) -> dict:
        if mixed:
            return _explicit(timeline, SERIES_UNITS.get(name, "count"), values)
        if base_dt is not None:
            return _regular(0.0, base_dt, SERIES_UNITS.get(name, "count"), values)
        return {"u": SERIES_UNITS.get(name, "count"), "v": values}

    # One canonical series per channel, resolved by documented precedence: the
    # canonical v2 spelling first, then the historical s_fluo/r_fluo vintage. A row
    # carrying both yields one series (canonical), never two, and says so.
    legacy_fluo_alias = False
    for candidates in V2_MAIN_CLOCK_PRECEDENCE:
        key = next((k for k in candidates if _array(data, k) is not None), None)
        if key is None:
            continue
        name = SERIES_BY_V2_KEY[key]
        series[name] = main_clock_series(name, _array(data, key))
        if key in V2_LEGACY_FLUO_KEYS:
            legacy_fluo_alias = True

    for key in AMBIENT_V2_KEYS:
        values = _array(data, key)
        if values is None:
            continue
        name = SERIES_BY_V2_KEY[key]
        unit = SERIES_UNITS[name]
        if not subsampled:
            series[name] = main_clock_series(name, values)
        elif not ambient_resolved or base_dt is None:
            # Values with no defensible time: emitted without a time model rather
            # than dated from the first segment's period (see _compat). The SQL
            # reaches the same shape, where a null base_dt makes every descriptor
            # null and to_json drops them.
            series[name] = {"u": unit, "v": values}
        elif mixed:
            series[name] = _explicit(ambient_centres, unit, values)
        else:
            # A single-frequency run collapses to the contract's regular form,
            # t0 = 3.5·dt and dt' = 8·dt, which is these same centres.
            series[name] = _regular(
                AMBIENT_SUBSAMPLE_CENTRE * base_dt,
                AMBIENT_SUBSAMPLE_FACTOR * base_dt,
                unit,
                values,
            )

    # Indices nobody has named yet keep their arr<idx> fallback name and the main
    # sample clock, so a new sensor array survives normalization unnamed instead
    # of being dropped on the floor.
    for key in _unknown_array_keys(data):
        values = _array(data, key)
        if values is not None:
            series[key] = main_clock_series(key, values)

    sensor_id = next((meta[k] for k in _SENSOR_ID_KEYS if meta.get(k)), None)

    protocol: dict[str, Any] = {
        "name": meta.get("protocol"),
        "cmd": obj.get("cmd_raw"),
        "segments": segments or None,
        "cal_version": cal_version_hex8(meta.get("cal_version")),
        "tick_factor": tick_factor,
        "gains": meta.get("gains"),
        "currents": meta.get("currents"),
    }

    normalized: dict[str, Any] = {
        "schema": TRACE_SCHEMA,
        "measure_id": obj.get("measure_id"),
        "channel": obj.get("channel"),
        "device": obj.get("device"),
        "sensor_id": sensor_id,
        "tag": obj.get("tag"),
        "time": {
            "start_utc": start_utc,
            "end_utc": end_utc,
            "duration_ms": duration_ms,
        },
        "protocol": protocol,
        "series": series,
        # Platform-side provenance for assumptions v2 could not state. Prefixed
        # like the pipeline's other transport key (_sample_encoding); consumers
        # of the contract ignore it.
        "_compat": {
            "source": "v2",
            "tick_factor_assumed": tick_factor,
            "mixed_segment_frequencies": mixed or None,
            "ambient_subsampled": subsampled or None,
            "ambient_time_unresolved": (subsampled and not ambient_resolved) or None,
            # The 630 nm channels came from the pre-rename s_fluo/r_fluo tags.
            "legacy_fluo_alias": legacy_fluo_alias or None,
        },
    }
    return _drop_nulls(normalized)


def _drop_nulls(value: Any) -> Any:
    """Drop null members, mirroring ``to_json``'s ignoreNullFields in the SQL.

    Series value arrays keep their nulls: a hole in the data is data.
    """
    if isinstance(value, dict):
        cleaned = {k: _drop_nulls(v) for k, v in value.items() if v is not None}
        return cleaned
    return value

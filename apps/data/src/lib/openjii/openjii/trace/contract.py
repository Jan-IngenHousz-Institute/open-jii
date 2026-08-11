"""Normative constants and reference logic for the AMBIT payload contract.

The contract is ``docs/mqtt-payload.md`` in the ambyte-iot repo: the persisted
event families ``ambit.trace/3``, ``ambyte.telemetry/1`` and ``ambit.device/1``,
plus the v2 dual-read rules.

Two implementations of the same rules exist in this repo:

* the SQL objects under ``openjii/trace/sql`` (what dashboards, Genie and the
  DP pipelines call), and
* this module (what notebooks call through :mod:`openjii.trace.timeseries`).

This module is the one the local test-suite can pin without a warehouse, so it
is where the numbers are defined; the SQL mirrors it and the shared fixtures in
``openjii/trace/fixtures`` are what keep the two honest.
"""

from __future__ import annotations

import math
import re
from typing import Any

# --- schema tags (contract §3, §9, §10) ------------------------------------

TRACE_SCHEMA = "ambit.trace/3"
TELEMETRY_SCHEMA = "ambyte.telemetry/1"
DEVICE_SCHEMA = "ambit.device/1"

# Any breaking change bumps the suffix; the family prefix is what dual-read and
# protocol attribution key on, so a future ambit.trace/4 keeps working.
TRACE_SCHEMA_FAMILY = "ambit.trace/"

# --- time model (contract §6) ---------------------------------------------

# v2 payloads carry no tick_factor (it only ever appeared in DEVICE_INFO), so
# the compat path assumes the fleet-wide calibration value. v3 producers send it.
V2_TICK_FACTOR = 0.854

# Firmware env cadence model: an in-run leaf-temp sample is gated by a 2000 ms
# minimum spacing on a loop that wakes every 8/freq seconds.
ENV_MIN_SPACING_S = 2.0
ENV_WAKE_PULSES = 8.0

# Subsampling = 2 means the ambient channels carry the mean of 8 pulses, so the
# series period is 8x the pulse period and the first sample sits at the centre
# of the first window.
AMBIENT_SUBSAMPLE_FACTOR = 8
AMBIENT_SUBSAMPLE_CENTRE = 3.5

# Relative times are seconds rendered at %.4f; consumers must not assume more
# than 0.1 ms resolution, so rounding here is lossless against the contract.
TIME_DECIMALS = 4
_TIME_SCALE = 10**TIME_DECIMALS
LEAF_TEMP_DECIMALS = 2

# --- series names (contract §5, settled 2026-08-10) -----------------------

# FSM idx 0..6 -> v2 key -> v3 series name. idx 7 (timing) is consumed into
# time.duration_ms and idx 8 (arr8) into leaf_temp.t, so neither is a series.
SERIES_BY_V2_KEY: dict[str, str] = {
    "env": "leaf_temp",
    "s_630": "fluo_630_signal",
    "r_630": "fluo_630_ref",
    "sun": "ambient_sun_vis",
    "leaf": "ambient_leaf_ir",
    "s_730": "refl_730_signal",
    "r_730": "refl_730_ref",
    # Historical vintage: FSM indices 1 and 2 were tagged s_fluo/r_fluo before the
    # firmware renamed them to s_630/r_630 (ambyte-iot lua_runner.c
    # `ambit_array_tag`, commit 7e64f14 -> the v2 tag table). Same indices, same
    # 630 nm signal/reference channels, so they normalize to the same canonical
    # series. Backlogs and SD-card replays still carry the old spelling, and every
    # T6 consumer should see one interface rather than branch on the vintage.
    #
    # NOT the same thing as the derived `fluo` ratio array, which was dropped from
    # the firmware in 2026-06 and is deliberately not carried over: that one is
    # fluo_630_signal[i] / fluo_630_ref[i], recomputed downstream.
    "s_fluo": "fluo_630_signal",
    "r_fluo": "fluo_630_ref",
}

# Which v2 key supplies each main-clock series, most canonical first. The order is
# the precedence: a payload should carry one vintage or the other, but if it
# carries both, the canonical spelling wins deterministically and `_compat`
# records that the legacy alias was also present rather than hiding it.
V2_MAIN_CLOCK_PRECEDENCE: tuple[tuple[str, ...], ...] = (
    ("s_630", "s_fluo"),
    ("r_630", "r_fluo"),
    ("s_730",),
    ("r_730",),
)

V2_LEGACY_FLUO_KEYS: tuple[str, ...] = ("s_fluo", "r_fluo")

SERIES_UNITS: dict[str, str] = {
    "leaf_temp": "Cel",
    "fluo_630_signal": "count",
    "fluo_630_ref": "count",
    "ambient_sun_vis": "count",
    "ambient_leaf_ir": "count",
    "refl_730_signal": "count",
    "refl_730_ref": "count",
}

# Series on the pulse clock, and the subset that is subsampled together. The
# main-clock tuple is flattened from the precedence table, so a legacy-vintage row
# contributes its length like any other.
MAIN_CLOCK_V2_KEYS = tuple(key for group in V2_MAIN_CLOCK_PRECEDENCE for key in group)
AMBIENT_V2_KEYS = ("sun", "leaf")

# Device-recorded env offsets, in ms since run start: an idx-8-aware AMBIT
# behind a pre-v3 Ambyte surfaces them under the unknown-index fallback name.
V2_ENV_OFFSET_KEY = "arr8"

# Unknown FSM indices keep the arr<idx> fallback name and are carried through
# normalization as count series on the main clock, so a sensor that starts
# sending a new array is not silently truncated by the platform before anyone
# has named it. The range is bounded rather than open: the compat SQL builds a
# fixed struct (a MAP-typed series object would downgrade integer counts to
# doubles), and the AMBIT's FSM array count is bounded well below this. Both
# implementations share the bound so neither preserves what the other drops.
V2_UNKNOWN_ARRAY_KEY = re.compile(r"\Aarr(\d+)\Z")
V2_UNKNOWN_ARRAY_RANGE = range(9, 16)
V2_UNKNOWN_ARRAY_KEYS = tuple(f"arr{index}" for index in V2_UNKNOWN_ARRAY_RANGE)

# uint32 wrap of the AMBIT's µs tick pair (idx 7).
_TICK_MODULUS_US = 4294967296


def unwrap_measurement(value: Any) -> Any:
    """Return the measurement object inside the firmware's ``sample:[…]`` shim.

    The wire contract keeps a one-element array; gold stores the object for new
    writes but history keeps the array, so every consumer has to accept both.
    """
    if isinstance(value, list) and len(value) == 1:
        return value[0]
    return value


def is_self_identifying(obj: Any) -> bool:
    """True when the object names its own schema (v3 and later)."""
    return isinstance(obj, dict) and bool(obj.get("schema"))


def is_trace(obj: Any) -> bool:
    """True when the object is an AMBIT trace measurement, v2 or v3."""
    if not isinstance(obj, dict):
        return False
    schema = obj.get("schema")
    if isinstance(schema, str):
        return schema.startswith(TRACE_SCHEMA_FAMILY)
    if schema is not None:
        return False
    cmd = obj.get("cmd_raw")
    if isinstance(cmd, str) and cmd.startswith("arrun"):
        return True
    data = obj.get("data")
    return isinstance(data, dict) and any(k in data for k in SERIES_BY_V2_KEY)


def wrap_safe_duration_ms(timing: Any) -> int | None:
    """Wrap-safe run duration in ms from the v2 ``data.timing`` µs tick pair.

    ``esp_timer_get_time()`` is truncated to uint32 on the wire, so it wraps
    every 71.6 min; the difference modulo 2^32 is the real elapsed time for any
    run short enough to fit the AMBIT's run buffer.
    """
    if not isinstance(timing, (list, tuple)) or len(timing) < 2:
        return None
    try:
        begin, end = int(timing[0]), int(timing[1])
    except (TypeError, ValueError):
        return None
    return round_half_up(((end - begin) % _TICK_MODULUS_US) / 1000)


def round_half_up(value: float) -> int:
    """Round to the nearest integer, halves away from zero.

        round_half_up(x) = sign(x) · floor(|x| + 0.5)

    The sign matters: a bare ``floor(x + 0.5)`` rounds negative halves *towards*
    zero (-0.5 -> 0 instead of -1). SQL applies the same branch, in
    ``round_half_up(v, 0)`` (``openjii/trace/sql/000_round_half_up.sql``).

    Expressed as scaled arithmetic rather than as a library rounding mode so the
    two implementations agree bit for bit: Python's ``round`` is ties-to-even and
    Spark's ``round`` is decimal half-up, and neither matches the other.
    """
    return -math.floor(-value + 0.5) if value < 0 else math.floor(value + 0.5)


def round_to(value: float, decimals: int) -> float:
    """Round to ``decimals`` places, halves away from zero.

        round_to(x, d) = sign(x) · floor(|x| · 10^d + 0.5) / 10^d

    Sign-aware, and not simplifiable to ``floor(x · 10^d + 0.5) / 10^d``: that
    form is half-up only for x >= 0 and rounds -24.605 to -24.60 instead of
    -24.61. Negative leaf and air temperatures are ordinary readings.

    The same branch, on the same scaled double arithmetic in the same order, is
    what ``round_half_up``/``round_half_up_array`` do in SQL. Python's
    ``round(x, 4)`` is ties-to-even and Spark's is decimal half-up; they disagree
    on 0.14945 (a freq-40 timeline at index 7), so neither is used.
    """
    scale = 10**decimals
    scaled = value * scale
    return (-math.floor(-scaled + 0.5) if value < 0 else math.floor(scaled + 0.5)) / scale


def round4(value: float) -> float:
    """The contract's %.4f rendering for relative times (t, t0, dt)."""
    return round_to(value, TIME_DECIMALS)


def round2(value: float) -> float:
    """The contract's two-fractional-digit rendering for leaf_temp values."""
    return round_to(value, LEAF_TEMP_DECIMALS)


def estimate_env_offsets(n: int, freq1: float | None, duration_s: float | None = None) -> list[float]:
    """Normative ``t_est`` estimator for leaf_temp offsets (contract §6).

    ``n`` is the number of values actually received, ``freq1`` the first
    segment's nominal frequency, ``duration_s`` the measured run window. The
    SQL compat view must produce these same numbers, which is why the formula
    lives in exactly one place.

    The clamp follows the formula literally: it applies whenever the duration is
    *known*, including a measured zero, which collapses every offset onto the
    run start. An unknown (absent) duration leaves the cadence model alone.
    """
    if n is None or n <= 0:
        return []
    delta = ENV_MIN_SPACING_S
    if freq1:
        delta = max(ENV_MIN_SPACING_S, ENV_WAKE_PULSES / float(freq1))
    if n > 1 and duration_s is not None and (n - 1) * delta > duration_s:
        delta = float(duration_s) / (n - 1)
    return [round4(k * delta) for k in range(n)]


def segment_timeline(segments: list[dict], tick_factor: float = V2_TICK_FACTOR) -> list[float]:
    """Explicit per-sample offsets across a multi-segment run (contract §6).

    Segment *k+1* continues segment *k*'s timeline at ``t0 + n_k·dt_k``. Used
    for mixed-frequency runs, where a single (t0, dt) cannot describe the series.
    The running cursor stays unrounded and only the emitted offset is rounded,
    matching the SQL, which accumulates with ``aggregate`` and rounds the result.
    """
    offsets: list[float] = []
    cursor = 0.0
    for segment in segments or []:
        freq = segment.get("freq") if isinstance(segment, dict) else None
        pulses = int((segment or {}).get("pulses") or 0)
        if not freq:
            continue
        dt = float(tick_factor) / float(freq)
        offsets.extend(round4(cursor + j * dt) for j in range(pulses))
        cursor += pulses * dt
    return offsets


def ambient_window_centres(segments: list[dict], tick_factor: float = V2_TICK_FACTOR) -> list[float]:
    """Offsets of the subsampled ambient means across a multi-segment run.

    With subsampling = 2 each ambient value is the mean of up to 8 consecutive
    pulses *within one segment*, so its timestamp is the centre of that window on
    that segment's clock:

        centre = segment_start + (window_start + (window_len - 1) / 2) · dt_seg

    For a full window on one segment this is the contract's ``t0 + 3.5·dt``; for
    a later segment it continues the piecewise timeline instead of freezing to
    the first segment's period. A trailing partial window is centred on the
    samples it actually contains.
    """
    centres: list[float] = []
    cursor = 0.0
    for segment in segments or []:
        freq = segment.get("freq") if isinstance(segment, dict) else None
        pulses = int((segment or {}).get("pulses") or 0)
        if not freq:
            continue
        dt = float(tick_factor) / float(freq)
        window = 0
        while window < pulses:
            length = min(AMBIENT_SUBSAMPLE_FACTOR, pulses - window)
            centres.append(round4(cursor + (window + (length - 1) / 2) * dt))
            window += AMBIENT_SUBSAMPLE_FACTOR
        cursor += pulses * dt
    return centres


def series_offsets(series: dict, count: int | None = None) -> list[float | None]:
    """Relative offsets, in seconds, for each sample of one series object.

    A series carries exactly one of the two forms: explicit ``t``, or regular
    (``t0``, ``dt``). There is no third encoding, so an explicit array is
    authoritative for every sample: a missing, null or non-numeric element yields
    ``None`` rather than being quietly refilled from (t0, dt), which would invent
    a timestamp the payload never stated. ``trace_points`` implements the same
    branch, so both sides return NULL for the same malformed input.

    Offsets are returned unrounded. The 4-decimal rendering is a producer rule
    applied when the normalizer *emits* t/t0/dt; re-applying it here would move a
    timestamp by up to half a millisecond relative to the SQL macro, which reads
    the emitted numbers as they are.
    """
    values = series.get("v") if isinstance(series, dict) else None
    n = count if count is not None else (len(values) if isinstance(values, list) else 0)
    explicit = series.get("t")
    if isinstance(explicit, list):
        return [_number_or_none(explicit[i]) if i < len(explicit) else None for i in range(n)]
    dt = series.get("dt")
    if dt is None:
        return [None] * n
    t0 = float(series.get("t0") or 0.0)
    return [t0 + i * float(dt) for i in range(n)]


def _number_or_none(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)

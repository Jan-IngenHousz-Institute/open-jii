"""AMBIT payload v3 support: the time model, the v2 compat rules, and the DDL.

Governed by ``docs/mqtt-payload.md`` in the ambyte-iot repo. The warehouse-side
implementation is the UC functions and views registered from
:mod:`openjii.trace.sql_objects`; this package is the notebook-side counterpart
and the single place the contract's numbers are written down.
"""

from .contract import (
    DEVICE_SCHEMA,
    SERIES_BY_V2_KEY,
    SERIES_UNITS,
    TELEMETRY_SCHEMA,
    TRACE_SCHEMA,
    TRACE_SCHEMA_FAMILY,
    V2_TICK_FACTOR,
    estimate_env_offsets,
    is_trace,
    segment_timeline,
    series_offsets,
    unwrap_measurement,
    wrap_safe_duration_ms,
)
from .normalize import cal_version_hex8, normalize_trace
from .timeseries import to_records, to_timeseries

__all__ = [
    "DEVICE_SCHEMA",
    "SERIES_BY_V2_KEY",
    "SERIES_UNITS",
    "TELEMETRY_SCHEMA",
    "TRACE_SCHEMA",
    "TRACE_SCHEMA_FAMILY",
    "V2_TICK_FACTOR",
    "cal_version_hex8",
    "estimate_env_offsets",
    "is_trace",
    "normalize_trace",
    "segment_timeline",
    "series_offsets",
    "to_records",
    "to_timeseries",
    "unwrap_measurement",
    "wrap_safe_duration_ms",
]

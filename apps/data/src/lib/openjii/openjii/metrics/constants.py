"""Pure string constants used by the metrics DLT pipeline.

No Spark session dependency. Safe to import anywhere.
"""

from __future__ import annotations

PLATFORM_TOTALS_TABLE = "platform_totals"
DAILY_ACTIVITY_TABLE = "daily_activity"
FAMILY_TOTALS_TABLE = "family_totals"
HOURLY_ACTIVITY_TABLE = "hourly_activity"
ACTIVITY_WINDOWS_TABLE = "activity_windows"
PARAMETER_STATS_TABLE = "parameter_stats"
POOL_FACTS_TABLE = "pool_facts"

# Backend-only scope tables: experiment- and user-grain rows that never leave
# the backend unaggregated; the public endpoint must not expose them.
DAILY_ACTIVITY_BY_EXPERIMENT_TABLE = "daily_activity_by_experiment"
EXPERIMENT_CONTRIBUTORS_WINDOW_TABLE = "experiment_contributors_window"

# Parameters eligible for the public "most measured" lines, keyed into
# macro_output. Only vetted names may surface publicly, and each name must be
# variant-path safe: keys with spaces, slashes, or "+" (Ambient Temperature,
# FvP/FmP, gH+) cannot be interpolated into try_variant_get paths.
PARAMETER_CATEGORY_DERIVED = "derived"
PARAMETER_CATEGORY_SENSOR = "sensor"

# Values a macro computes from the measurement.
DERIVED_PARAMETER_ALLOWLIST = (
    "Phi2",
    "PhiNPQ",
    "PhiNO",
    "NPQt",
    "LEF",
    "qL",
    "qP",
    "RFd",
    "SPAD",
)

# Raw instrument readings echoed into the macro output.
SENSOR_PARAMETER_ALLOWLIST = (
    "humidity",
    "pressure",
    "temperature",
    "light_intensity",
    "PAR",
    "thickness",
)

ACTIVITY_WINDOW_DAYS = 30

# Family bucket for rows without a broker identity (imported, large-IoT,
# Cognito publishers) or without a registry match.
UNATTRIBUTED_FAMILY = "unattributed"

# Devices with an unset RTC report epoch-era timestamps; clock skew produces
# future ones. Both would corrupt public min/max stats and chart domains.
MEASUREMENT_TIMESTAMP_FLOOR = "2000-01-01"

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
DAILY_ACTIVITY_BY_RESOURCE_TABLE = "daily_activity_by_resource"

# Resource kinds the list-page activity strips cover. Workbooks are keyed by
# version because that is what a measurement records.
RESOURCE_TYPE_PROTOCOL = "protocol"
RESOURCE_TYPE_WORKBOOK_VERSION = "workbook_version"
RESOURCE_TYPE_MACRO = "macro"

# Parameters eligible for the public "most measured" lines, keyed into
# macro_output. Only vetted names may surface publicly, and each name must be
# variant-path safe: keys with spaces, slashes, or "+" (Ambient Temperature,
# FvP/FmP, gH+) cannot be interpolated into try_variant_get paths.
PARAMETER_CATEGORY_DERIVED = "derived"
PARAMETER_CATEGORY_SENSOR = "sensor"

# Provenance decides the category. A macro wrote everything in macro_output, so
# those are derived whatever they describe; a sensor reading is one the device
# put in its own payload before any macro ran.
DERIVED_PARAMETER_ALLOWLIST = (
    # MultispeQ, from the fluorescence macro.
    "Phi2",
    "PhiNPQ",
    "PhiNO",
    "NPQt",
    "LEF",
    "qL",
    "qP",
    "RFd",
    "SPAD",
    # Ambit, computed from the spectrum and orientation sensors.
    "red_fraction",
    "green_fraction",
    "blue_fraction",
    "tilt_angle_deg",
    "par_umol_m2_s",
    "relative_humidity_pct",
    "air_temperature_c",
    "contactless_temperature_c",
    "pressure_hpa",
)

# Scalars the device records in its own payload, read from the measurement
# rather than from a macro's output.
SENSOR_PARAMETER_ALLOWLIST = (
    "par",
    "temperature",
    "humidity",
    "pressure",
    "light_intensity",
    "thickness",
)

# Public copy for the parameter lines. A key the instrument wrote reads as a
# column name on a landing page, so the pipeline ships the label with the
# figure and the frontend renders what it is given.
PARAMETER_LABELS = {
    "Phi2": "Photosystem II efficiency (Phi2)",
    "PhiNPQ": "Regulated heat dissipation (PhiNPQ)",
    "PhiNO": "Unregulated dissipation (PhiNO)",
    "NPQt": "Non-photochemical quenching (NPQt)",
    "LEF": "Linear electron flow (LEF)",
    "qL": "Open reaction centres (qL)",
    "qP": "Photochemical quenching (qP)",
    "RFd": "Fluorescence decline ratio (RFd)",
    "SPAD": "Relative chlorophyll (SPAD)",
    "red_fraction": "Red reflectance fraction",
    "green_fraction": "Green reflectance fraction",
    "blue_fraction": "Blue reflectance fraction",
    "tilt_angle_deg": "Leaf tilt angle (degrees)",
    "par_umol_m2_s": "Light intensity, PAR (umol/m2/s)",
    "relative_humidity_pct": "Relative humidity (%)",
    "air_temperature_c": "Air temperature (C)",
    "contactless_temperature_c": "Leaf temperature, contactless (C)",
    "pressure_hpa": "Air pressure (hPa)",
    "par": "Light intensity, PAR",
    "temperature": "Temperature",
    "humidity": "Relative humidity",
    "pressure": "Air pressure",
    "light_intensity": "Light intensity",
    "thickness": "Leaf thickness",
}

ACTIVITY_WINDOW_DAYS = 30

# Parameters get a wider window than activity does. Which instrument is in
# the field varies month to month, and a 30-day view described whichever
# family happened to be collecting rather than the platform.
PARAMETER_WINDOW_DAYS = 90

# Family bucket for rows without a broker identity (imported, large-IoT,
# Cognito publishers) or without a registry match.
UNATTRIBUTED_FAMILY = "unattributed"

# Devices with an unset RTC report epoch-era timestamps; clock skew produces
# future ones. Both would corrupt public min/max stats and chart domains.
MEASUREMENT_TIMESTAMP_FLOOR = "2000-01-01"

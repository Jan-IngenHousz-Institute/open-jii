"""Pure string constants used by the metrics DLT pipeline.

No Spark session dependency. Safe to import anywhere.
"""

from __future__ import annotations

PLATFORM_TOTALS_TABLE = "platform_totals"
DAILY_ACTIVITY_TABLE = "daily_activity"
FAMILY_TOTALS_TABLE = "family_totals"

# Family bucket for rows without a broker identity (imported, large-IoT,
# Cognito publishers) or without a registry match.
UNATTRIBUTED_FAMILY = "unattributed"

# Devices with an unset RTC report epoch-era timestamps; clock skew produces
# future ones. Both would corrupt public min/max stats and chart domains.
MEASUREMENT_TIMESTAMP_FLOOR = "2000-01-01"

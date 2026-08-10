"""Timezone safety for enriched measurement views."""

from pyspark.sql import Column
from pyspark.sql import functions as F


def drop_invalid_timezone(timezone: Column) -> Column:
    """Return null when Spark cannot use the supplied timezone."""
    valid = F.try_make_timestamp(
        F.lit(2000), F.lit(1), F.lit(1), F.lit(0), F.lit(0), F.lit(0), timezone
    ).isNotNull()
    return F.when(valid, timezone)

"""Time zones a reader can convert with."""

from pyspark.sql import Column
from pyspark.sql import functions as F


def usable_timezone(timezone: Column) -> Column:
    """The zone when Spark accepts it, otherwise null.

    Devices report zones Spark rejects, and one such value fails any query that
    converts with it. Checking once on write lets readers convert without a
    per-row check, which Photon cannot run.
    """
    probe = F.call_function("try_make_timestamp", *(F.lit(v) for v in (2000, 1, 1, 0, 0, 0)), timezone)
    return F.when(probe.isNotNull(), timezone)

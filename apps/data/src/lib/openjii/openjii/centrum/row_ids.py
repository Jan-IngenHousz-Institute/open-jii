"""Row ids that stay the same however often a capture arrives."""

from pyspark.sql import Column
from pyspark.sql import functions as F

# Keeps a 64-bit hash positive. abs() cannot: the smallest 64-bit value has no positive twin.
_POSITIVE_63_BITS = 0x7FFFFFFFFFFFFFFF
# Every id before the 64-bit ids was the abs() of a 32-bit hash, so below this.
_FIRST_63_BIT_ID = 2**31


def positive_hash(*columns: Column) -> Column:
    """A 63-bit hash of the columns, never negative."""
    return F.xxhash64(*columns).bitwiseAND(F.lit(_POSITIVE_63_BITS))


def measurement_id(earlier: Column) -> Column:
    """The id of a measurement row, from the phone's record id when it sent one, else from the capture.

    The phone sends its local record id as `_client_id`, and sends it again whenever it re-publishes
    that record, so the copies of one capture share an id. A publisher that sends none, such as a
    device on its own certificate, gets an id from what the capture holds. The record id comes from
    the client, so it only counts within its experiment. A 64-bit hash rather than 32-bit hash(),
    whose ids collide once an experiment holds tens of thousands of rows.

    Bronze writes `_client_id` empty when a payload has none, so it reads null only on rows bronze
    wrote before it kept the field. Those keep the id they were given then, `earlier`, so a refresh
    of silver gives them back the ids their annotations point at.

    Reads `experiment_id`, `_client_id`, `device_id`, `timestamp`, `sample`, `user_id` and
    `questions`, with `sample` decompressed.
    """
    record = F.col("_client_id")
    return (
        F.when(record.isNull(), earlier.cast("long"))
        .when(record != "", positive_hash(F.col("experiment_id"), record))
        .otherwise(
            positive_hash(
                F.col("experiment_id"),
                F.col("device_id"),
                F.col("timestamp"),
                F.col("sample"),
                F.col("user_id"),
                F.col("questions"),
            )
        )
    )


def macro_result_id() -> Column:
    """The id of one macro's result for one measurement, the same each time that macro runs on it.

    A measurement from before the 64-bit ids has an id that fits 31 bits, which a 63-bit hash does about
    once in four billion. Its results keep the formula they were given then, which hashed silver's
    processing time, so a refresh of the macro table gives them back the ids their annotations point at.

    Reads `experiment_id`, `id`, the measurement's, `macro_filename` and `processed_timestamp`.
    """
    earlier = F.abs(F.hash(F.col("id"), F.col("macro_filename"), F.col("processed_timestamp"))).cast("long")
    return F.when(F.col("id") < _FIRST_63_BIT_ID, earlier).otherwise(
        positive_hash(F.col("experiment_id"), F.col("id"), F.col("macro_filename"))
    )

"""
Compression helpers for IoT sensor payloads.

The mobile app gzip-compresses and base64-encodes the large `sample` field
before publishing over MQTT.  The pipeline must reverse this in the Silver
layer.  Keeping the logic here makes it reusable across notebooks and testable
outside of Spark.
"""

import base64
import gzip

from pyspark.sql import functions as F
from pyspark.sql.types import StringType


def decompress_sample_value(encoded_sample: str | None, encoding: str | None) -> str | None:
    """Decompress a gzip+base64-encoded sample string back to JSON.

    Parameters
    ----------
    encoded_sample : str | None
        The (possibly compressed) sample value.
    encoding : str | None
        Encoding marker sent by the producer.  Currently only
        ``"gzip+base64"`` is recognised.  ``None`` means the sample is
        already plain JSON (legacy payloads).

    Returns
    -------
    str | None
        The original JSON string, or the input unchanged when no
        decompression is needed.
    """
    if encoding is None or encoded_sample is None:
        return encoded_sample
    if encoding == "gzip+base64":
        compressed = base64.b64decode(encoded_sample)
        return gzip.decompress(compressed).decode("utf-8")
    # Unknown encoding — pass through unchanged
    return encoded_sample


#: Spark UDF wrapping :func:`decompress_sample_value`.
#: Use this directly in ``.withColumn()`` calls.
decompress_sample = F.udf(decompress_sample_value, StringType())

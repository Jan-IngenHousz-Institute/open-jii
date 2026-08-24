"""Scrubbing of non-standard JSON tokens in device payloads.

Device firmware and calibration tooling serialize floats permissively, so
samples can carry bare NaN / Infinity / -Infinity tokens. Strict JSON parsers
(Spark's parse_json, Jackson) reject the whole record, which poisons the
streaming flow. Reparsing with Python's json module maps those tokens to null
and keeps the record.
"""

import json

from pyspark.sql import functions as F
from pyspark.sql.types import StringType


def scrub_non_finite_json_value(payload: str | None) -> str | None:
    """Rewrite bare NaN / Infinity tokens to null so strict parsers accept the payload.

    Payloads without suspicious substrings pass through untouched and unparsed,
    so the happy path is a cheap scan. Payloads that fail to parse outright are
    also returned unchanged; the caller's try_parse_json nulls them.
    """
    if payload is None:
        return None

    if "NaN" not in payload and "Infinity" not in payload:
        return payload

    try:
        parsed = json.loads(payload, parse_constant=lambda _token: None)
    except (ValueError, RecursionError):
        return payload

    return json.dumps(parsed, ensure_ascii=False)


#: Spark UDF wrapping :func:`scrub_non_finite_json_value`.
#: Use this directly in ``.withColumn()`` calls.
scrub_non_finite_json = F.udf(scrub_non_finite_json_value, StringType())

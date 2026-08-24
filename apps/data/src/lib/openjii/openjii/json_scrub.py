"""Scrubbing of non-standard JSON tokens in device payloads.

Device firmware and calibration tooling serialize floats permissively, so
samples can carry bare NaN / Infinity / -Infinity tokens. Strict JSON parsers
(Spark's parse_json, Jackson) reject the whole record, which poisons the
streaming flow. The scrub rewrites the tokens to null and leaves every other
byte untouched, so high-precision numbers keep their exact text for variant
parsing.
"""

import re

from pyspark.sql import functions as F
from pyspark.sql.types import StringType

# The string-literal branch wins the leftmost alternation and consumes
# literals whole (escapes included), so tokens only match outside strings.
_STRING_OR_NON_FINITE_TOKEN = re.compile(r'"(?:[^"\\]|\\.)*"|-?Infinity|NaN')


def _null_unless_string(match: re.Match[str]) -> str:
    text = match.group()
    return text if text.startswith('"') else "null"


def scrub_non_finite_json_value(payload: str | None) -> str | None:
    """Rewrite bare NaN / Infinity tokens to null so strict parsers accept the payload.

    Payloads without suspicious substrings pass through untouched, so the happy
    path is a cheap scan. Tokens inside string literals are preserved. The scan
    does not validate JSON; unparseable payloads come out as unparseable, and
    the caller's try_parse_json nulls them.
    """
    if payload is None:
        return None

    if "NaN" not in payload and "Infinity" not in payload:
        return payload

    return _STRING_OR_NON_FINITE_TOKEN.sub(_null_unless_string, payload)


#: Spark UDF wrapping :func:`scrub_non_finite_json_value`.
#: Use this directly in ``.withColumn()`` calls.
scrub_non_finite_json = F.udf(scrub_non_finite_json_value, StringType())

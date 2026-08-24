"""Scrubbing of non-standard JSON tokens in device payloads.

Device firmware and calibration tooling serialize floats permissively, so
samples can carry bare NaN / Infinity / -Infinity tokens. Strict JSON parsers
(Spark's parse_json, Jackson) reject the whole record, which poisons the
streaming flow. A string-literal-aware scan rewrites the tokens to null and
leaves every other byte untouched, so high-precision numbers keep their exact
text for variant parsing.
"""

from pyspark.sql import functions as F
from pyspark.sql.types import StringType

_NON_FINITE_TOKENS = ("-Infinity", "Infinity", "NaN")


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

    parts: list[str] = []
    in_string = False
    escaped = False
    i = 0

    while i < len(payload):
        char = payload[i]

        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            parts.append(char)
            i += 1
            continue

        if char == '"':
            in_string = True
            parts.append(char)
            i += 1
            continue

        token = next((t for t in _NON_FINITE_TOKENS if payload.startswith(t, i)), None)
        if token is not None:
            parts.append("null")
            i += len(token)
        else:
            parts.append(char)
            i += 1

    return "".join(parts)


#: Spark UDF wrapping :func:`scrub_non_finite_json_value`.
#: Use this directly in ``.withColumn()`` calls.
scrub_non_finite_json = F.udf(scrub_non_finite_json_value, StringType())

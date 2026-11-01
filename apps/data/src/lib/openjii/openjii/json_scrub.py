"""Scrubbing of non-standard JSON tokens in device payloads.

Device firmware and calibration tooling serialize floats permissively, so
samples can carry bare NaN / Infinity / -Infinity tokens. Strict JSON parsers
(Spark's parse_json, Jackson) reject the whole record, which poisons the
streaming flow. The scrub rewrites the tokens to null and leaves every other
byte untouched, so high-precision numbers keep their exact text for variant
parsing.
"""

import re

from pyspark.sql import Column
from pyspark.sql import functions as F

# A string literal runs to its closing quote, or to the end of the payload when it has none, so a
# literal never fails and the scan never retries from a later quote: the cost stays linear. Each
# character inside has one way to match, so nothing can backtrack either; a lone backslash can only
# end the payload.
_STRING_OR_NON_FINITE_TOKEN = re.compile(r'"(?:[^"\\]|\\[\s\S])*(?:"|\\?(?![\s\S]))|-?Infinity|NaN')

# The same literals for Spark, plus the text between them, so the pieces join back into the payload.
# Possessive runs let Java's regex engine scan a long literal without recursing.
_SPARK_PIECES = r'"(?:[^"\\]++|\\[\s\S])*+(?:"|\\?(?![\s\S]))|[^"]++'
_NON_FINITE_TOKEN = r"-?Infinity|NaN"


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


def _null_unless_string_piece(piece: Column) -> Column:
    return F.when(piece.startswith('"'), piece).otherwise(F.regexp_replace(piece, _NON_FINITE_TOKEN, "null"))


def scrub_non_finite_json(payload: Column) -> Column:
    """:func:`scrub_non_finite_json_value` as Spark expressions. A Python UDF would start a Python
    worker for a batch, which costs seconds on the pipelines' compute when the worker is cold."""
    pieces = F.transform(F.regexp_extract_all(payload, F.lit(_SPARK_PIECES), 0), _null_unless_string_piece)
    has_token = payload.contains("NaN") | payload.contains("Infinity")

    return F.when(has_token, F.array_join(pieces, "")).otherwise(payload)

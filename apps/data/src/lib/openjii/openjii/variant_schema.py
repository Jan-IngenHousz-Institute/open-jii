"""Schemas of VARIANT columns, merged from one sample per distinct schema.

schema_of_variant types every decimal with its own precision, so nearly every
macro result would count as a schema of its own. Reported as DOUBLE, decimals
collapse to a handful of schemas per table. Merging schemas ignores order and
repeats, so the merge over one sample per normalised schema equals the merge
over every row.
"""

from __future__ import annotations

from pyspark.sql import Column
from pyspark.sql import functions as F

# A type position, never a field name: the start of the schema, after a field's
# colon, or inside an ARRAY or OBJECT bracket.
_DECIMAL_TYPE = r"(^|: |<)DECIMAL\(\d+,\d+\)"


def _decimals_as_double(schema: Column) -> Column:
    return F.regexp_replace(schema, _DECIMAL_TYPE, "$1DOUBLE")


def variant_schema_key(expression: str) -> Column:
    """The normalised schema of one VARIANT value, never null so it can key a table."""
    return F.coalesce(_decimals_as_double(F.expr(f"schema_of_variant({expression})")), F.lit(""))


def merged_variant_schema(expression: str) -> Column:
    """The normalised merge of a group's VARIANT values, null when none has a type."""
    return _decimals_as_double(F.expr(f"nullif(schema_of_variant_agg({expression}), 'VOID')"))

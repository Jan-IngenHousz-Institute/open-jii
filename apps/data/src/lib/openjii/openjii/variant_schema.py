"""Schemas of VARIANT columns, merged from one sample per distinct schema.

schema_of_variant types every decimal with its own precision, so nearly every
macro result would count as a schema of its own. Reported as DOUBLE, decimals
collapse to a handful of schemas per table. Merging schemas ignores order and
repeats, so the merge over one sample per normalised schema equals the merge
over every row.
"""

from __future__ import annotations

from pyspark.sql import Column, DataFrame
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


def custom_metadata_schemas(sheets: DataFrame, *keys: str) -> DataFrame:
    """The schema of the custom metadata the sheets in ``sheets`` hold, per group of ``keys``, in
    column ``custom_metadata_schema``, decimals kept. Each row leaves out its ``_id`` and its
    identifier, so a read does not expand them into columns that repeat it. Rows that are no
    object, and ``rows`` that is no array, add nothing, as the sheets' rows leave them out."""
    return (
        sheets.select(
            *keys,
            F.expr("variant_get(metadata, '$.identifierColumnId', 'STRING')").alias("_id_col"),
            F.expr("explode(try_variant_get(metadata, '$.rows', 'ARRAY<VARIANT>'))").alias("_row"),
        )
        .withColumn(
            "_row",
            F.expr("""
                parse_json(to_json(map_filter(
                    try_variant_get(_row, '$', 'MAP<STRING, VARIANT>'),
                    (k, v) -> k != '_id' AND k != _id_col
                )))
            """),
        )
        .groupBy(*keys)
        .agg(F.expr("nullif(schema_of_variant_agg(_row), 'VOID')").alias("custom_metadata_schema"))
    )

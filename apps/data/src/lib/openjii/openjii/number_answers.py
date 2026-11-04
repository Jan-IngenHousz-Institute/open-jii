"""Finite numeric conversion for approved question storage and platform reads."""

from pyspark.sql import Column
from pyspark.sql import functions as F

BLANK_ANSWER_PATTERN = r"^[\x09-\x0D ]*$"
NUMBER_ANSWER_PATTERN = r"^[\x09-\x0D ]*[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?[\x09-\x0D ]*$"


def number_answer(value: Column) -> Column:
    number = value.try_cast("double")
    finite = ~F.isnan(number) & (F.abs(number) != F.lit(float("inf")))
    return F.when(value.rlike(NUMBER_ANSWER_PATTERN) & finite, number)


def typed_question_answers_expression(value: str, numeric_keys: str) -> str:
    """SQL expressions are supplied by the pipeline or the validated backfill command."""
    text = "try_cast(answer AS STRING)"
    number = f"try_cast({text} AS DOUBLE)"
    finite = f"nullif(nullif(nullif({number}, double('NaN')), double('Infinity')), double('-Infinity'))"
    return f"""to_variant_object(transform_values(
        cast({value} AS MAP<STRING, VARIANT>),
        (key, answer) -> CASE
            WHEN {text} RLIKE r'{BLANK_ANSWER_PATTERN}' THEN parse_json('null')
            WHEN array_contains({numeric_keys}, key) THEN coalesce(
                cast(CASE WHEN {text} RLIKE r'{NUMBER_ANSWER_PATTERN}' THEN {finite} END AS VARIANT),
                parse_json('null'))
            ELSE answer END))"""


def typed_question_answers(value: str, numeric_keys: str) -> Column:
    quoted_value = "`" + value.replace("`", "``") + "`"
    quoted_keys = "`" + numeric_keys.replace("`", "``") + "`"
    return F.expr(typed_question_answers_expression(quoted_value, quoted_keys))


def invalid_question_answer_count_expression(value: str, typed: str, numeric_keys: str) -> str:
    return f"""coalesce(aggregate(map_entries(cast({value} AS MAP<STRING, VARIANT>)), 0,
        (n, entry) -> n + CASE WHEN array_contains({numeric_keys}, entry.key)
            AND entry.value IS NOT NULL AND NOT is_variant_null(entry.value)
            AND (try_cast(entry.value AS STRING) IS NULL OR NOT (try_cast(entry.value AS STRING) RLIKE r'{BLANK_ANSWER_PATTERN}'))
            AND is_variant_null(try_element_at(cast({typed} AS MAP<STRING, VARIANT>), entry.key))
        THEN 1 ELSE 0 END), 0)"""

"""Numeric views of approved question answers. Gold and metadata joins keep the original text."""

from pyspark.sql import Column
from pyspark.sql import functions as F

NUMBER_ANSWER_PATTERN = r"^[\x09-\x0D ]*[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?[\x09-\x0D ]*$"


def number_answer(value: Column) -> Column:
    number = value.try_cast("double")
    finite = ~F.isnan(number) & (F.abs(number) != F.lit(float("inf")))
    return F.when(value.rlike(NUMBER_ANSWER_PATTERN) & finite, number)

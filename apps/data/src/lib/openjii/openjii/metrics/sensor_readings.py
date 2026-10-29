"""Sensor readings out of a device payload."""

from __future__ import annotations

from pyspark.sql import Column
from pyspark.sql import functions as F


def sensor_readings(payload: str, name: str) -> Column:
    """Every reading of ``name`` in a payload, whatever its shape, as an array of doubles.

    ``payload`` is a SQL expression for the payload's JSON text. A payload is an array
    of samples. Ambit-family samples carry their scalars in a ``data`` object;
    MultispeQ, MiniPAR and PhotosynQ samples carry them in a nested ``set`` array, one
    entry per reading. Reading only one of those shapes drops the other instrument's
    readings entirely, and reading only the first entry would sample rather than
    aggregate. Readings that are missing or not numbers are left out; a null or
    unparseable payload gives null.
    """
    return F.expr(
        f"""
        filter(
          flatten(
            transform(
              from_json({payload}, 'array<string>'),
              x -> concat(
                array(try_cast(get_json_object(x, '$.data.{name}') as double)),
                transform(
                  from_json(coalesce(get_json_object(x, '$.set'), '[]'), 'array<string>'),
                  s -> try_cast(get_json_object(s, '$.{name}') as double)
                )
              )
            )
          ),
          v -> v is not null
        )
        """
    )

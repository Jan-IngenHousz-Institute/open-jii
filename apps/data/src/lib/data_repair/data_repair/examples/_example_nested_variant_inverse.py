"""
Scenario: a nested array inside a VARIANT column carries values that were
mutated in-place by an upstream client. The mutation is invertible (here:
negation, an involution). Predicate gates the repair to the affected
client/version + macro combination so it never re-applies.

Use case: RIDES 2.0/2.1 mobile-v1.16.7 in-place data_raw negation.
"""
from pyspark.sql import functions as F

from ..manifest import register_function_repair


# Affected macro IDs and the cutoff at which the upstream fix shipped.
_AFFECTED_MACRO_IDS = [
    "21aed8a2-f95b-4f28-b025-44f6d96447e7",  # RIDES 2.0
    "5bbf306c-d880-4f04-ac04-dd76fe545182",  # RIDES 2.1
]
_CUTOFF = "2026-04-19"  # mobile-v1.16.8 ship date


def _invert_data_raw_in_pam_set(data_col):
    """Walk the VARIANT array, negate data_raw inside set entries labelled 'PAM'.

    The transform is an involution (negate twice = identity), so the predicate
    must accurately exclude already-clean rows; idempotency relies on the
    `processed_timestamp < cutoff` check at the call site.
    """
    return F.expr(
        """
        transform(data, m -> named_struct(
          'macros', m.macros,
          'protocol_id', m.protocol_id,
          'set', transform(m.set, s -> case
            when s.label = 'PAM'
              then named_struct('label', s.label,
                                'data_raw', transform(s.data_raw, x -> -x))
            else s
          end)
        ))
        """
    )


@register_function_repair(
    table="experiment_raw_data",
    issue="OJD-571 / GH#1056",
    description=(
        "RIDES 2.0/2.1 macros mutated data_raw in-place pre mobile-v1.16.8. "
        "Re-apply negation to recover original values."
    ),
)
def rides_inplace_negation(df):
    affected = (
        F.exists(F.col("macros"), lambda m: m["id"].isin(_AFFECTED_MACRO_IDS))
        & (F.col("processed_timestamp") < F.lit(_CUTOFF))
    )
    return df.withColumn(
        "data",
        F.when(affected, _invert_data_raw_in_pam_set(F.col("data"))).otherwise(F.col("data")),
    )

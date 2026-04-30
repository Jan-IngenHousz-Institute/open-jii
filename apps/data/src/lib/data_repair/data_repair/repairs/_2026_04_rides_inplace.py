"""
OJD-571 / GH#1056. RIDES 2.0/2.1 mutate PAM.data_raw in place:

    [a0, b0, a1, b1, ...]  ->  [a0, a1, ..., b0, b1, ...]

Mobile pre-v1.16.8 leaked the mutation into bronze. Server re-runs the
de-interleave a second time, producing unphysical NPQt/FvP_FmP/Phi2. We
re-interleave at gold before the macro UDF.

The inverse is not self-idempotent. Single application relies on
full-refresh-once after deploy + streaming-append semantics thereafter.
"""
from __future__ import annotations

import json

import pandas as pd
from pyspark.sql import functions as F
from pyspark.sql.types import StringType

from ..manifest import inline_repair


# Prod UUIDs. Dev has different IDs; predicate no-ops there, which is fine.
_RIDES_MACRO_IDS = (
    "21aed8a2-f95b-4f28-b025-44f6d96447e7",  # Photosynthesis RIDES 2.0
    "5bbf306c-d880-4f04-ac04-dd76fe545182",  # Photosynthesis RIDES 2.1
)


def _reinterleave(arr: list) -> list:
    """Re-weave [A0..A_{h-1}, B0..B_{N-h-1}] back into [A0, B0, A1, B1, ...]
    where h = ceil(N/2). Odd N leaves the trailing A element unpaired."""
    n = len(arr)
    if n < 2:
        return arr
    h = (n + 1) // 2
    out = [None] * n
    for i in range(n):
        if i % 2 == 0:
            out[i] = arr[i // 2]
        else:
            out[i] = arr[h + (i - 1) // 2]
    return out


def _reinvert_pam_payload(value) -> str | None:
    """Re-interleave PAM.data_raw in the VARIANT payload. Returns a JSON
    string; the caller wraps with parse_json on the Spark side."""
    if value is None:
        return None
    try:
        raw_json = value.toJson() if hasattr(value, "toJson") else value
        obj = json.loads(raw_json)
    except (json.JSONDecodeError, TypeError):
        return None
    for elem in obj or []:
        for s in (elem.get("set") or []):
            if s.get("label") == "PAM":
                raw = s.get("data_raw")
                if raw and len(raw) >= 2:
                    s["data_raw"] = _reinterleave(raw)
    return json.dumps(obj)


@F.pandas_udf(StringType())
def _reinvert_pam_udf(data: pd.Series) -> pd.Series:
    return data.apply(_reinvert_pam_payload)


@inline_repair(
    table="experiment_macro_data",
    issue="OJD-571 / GH#1056",
    description=(
        "RIDES 2.0/2.1 in-place de-interleave of PAM.data_raw. Inverse "
        "re-weaves the two halves before the macro UDF runs."
    ),
    severity="apply",
)
def rides_pam_reinterleave(df):
    affected = F.col("macro_id").isin(list(_RIDES_MACRO_IDS))
    return (
        df.withColumn(
            "_rides_repaired_json",
            F.when(affected, _reinvert_pam_udf(F.col("data"))),
        )
        .withColumn(
            "data",
            F.when(
                F.col("_rides_repaired_json").isNotNull(),
                F.expr("parse_json(_rides_repaired_json)"),
            ).otherwise(F.col("data")),
        )
        .drop("_rides_repaired_json")
    )

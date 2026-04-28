"""
2026_04_rides_inplace.py: OJD-571 / GH#1056

The RIDES 2.0 (macro_63d68236e245) and RIDES 2.1 (macro_28cfc86e2530) macros
do an in-place de-interleave on `PAM.data_raw`:

    [a0, b0, a1, b1, ..., aN, bN]  ->  [a0, a1, ..., aN, b0, b1, ..., bN]

Mobile pre-v1.16.8 ran macros via `new Function("json", code)(json)` in the
caller's heap, so `PAM.data_raw = temp1` leaks into the uploaded sample.
Bronze stores the de-interleaved version. Server-side re-derivation runs the
same de-interleave a second time on already-de-interleaved input -- producing
scrambled values and unphysical derived parameters (negative Phi2, NPQt,
FvP/FmP).

The mobile fix in v1.16.8 was meant to ship 2026-04-19 but as of 2026-04-28,
100% of post-cutoff RIDES rows in prod are still corrupt (Q6 of
scope_ojd571_rides_corruption.sql). Fix did not actually ship. This repair
fires on every row whose macro_id is RIDES 2.0/2.1 -- no time/version gate.

Repair point: `experiment_macro_data` (gold), just before the macro UDF
runs. Full-refresh experiment_macro_data after deploy to retroactively
correct the ~4400 historical rows; experiment_raw_data is untouched.

Predicate: macro_id IN (RIDES 2.0, RIDES 2.1).
Idempotency: the inverse is not self-idempotent (re-applying it would
re-corrupt). Single application is enforced by full-refresh-once + the
streaming nature of the table thereafter; once a row is written with
corrected macro_output, it is not re-processed.
"""
from __future__ import annotations

import json

import pandas as pd
from pyspark.sql import functions as F
from pyspark.sql.types import StringType

from ..manifest import inline_repair


# Prod UUIDs. Dev assigns different IDs per insert, so the predicate is a
# no-op there, which is fine -- corruption only manifests in prod where
# mobile uploads land.
_RIDES_MACRO_IDS = (
    "21aed8a2-f95b-4f28-b025-44f6d96447e7",  # Photosynthesis RIDES 2.0
    "5bbf306c-d880-4f04-ac04-dd76fe545182",  # Photosynthesis RIDES 2.1
)


def _reinterleave(arr: list) -> list:
    """Inverse of the macro's de-interleave.

    The macro builds temp1 by:
        for i in 0,2,4,...:  temp1.push(data_raw[i])   -> ceil(N/2) channel-A
        for i in 1,3,5,...:  temp1.push(data_raw[i])   -> floor(N/2) channel-B

    So persisted[0..h)  = original even-indexed values (channel A)
       persisted[h..N)  = original odd-indexed values  (channel B)
    where h = ceil(N/2). To invert:
        out[2k]   = persisted[k]
        out[2k+1] = persisted[h + k]
    """
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
    """Walk the VARIANT payload and re-interleave each PAM set's data_raw.

    Returns a JSON string; the caller wraps with parse_json on the Spark side.
    """
    if value is None:
        return None
    try:
        raw_json = value.toJson() if hasattr(value, "toJson") else value
        obj = json.loads(raw_json)
    except Exception:
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
    severity="advisory",
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

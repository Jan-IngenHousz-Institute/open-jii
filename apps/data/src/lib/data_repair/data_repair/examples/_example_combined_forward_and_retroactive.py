"""
Scenario: same incident needs BOTH:
- a function-based silver-side repair, so any straggler rows still arriving
  from old clients get corrected on the way in (forward protection); AND
- an overlay-based gold-side repair, so historical rows already emitted into
  experiment_macro_data are surfaced as corrected via the view.

Both decorators live in the same file because they're driven by the same
incident — keeps the diagnosis + cutoff + macro list co-located.
"""
from pyspark.sql import functions as F

from ..manifest import register_function_repair, register_overlay_repair


_AFFECTED_MACRO_IDS = ["..."]
_CUTOFF = "2026-04-19"


@register_function_repair(
    table="experiment_raw_data",
    issue="OJD-XXXX",
    description="Forward protection: repair raw data for stragglers from old clients.",
)
def silver_repair_for_old_clients(df):
    affected = (
        F.exists(F.col("macros"), lambda m: m["id"].isin(_AFFECTED_MACRO_IDS))
        & (F.col("processed_timestamp") < F.lit(_CUTOFF))
    )
    # Inverse transform omitted for brevity — same shape as
    # _example_nested_variant_inverse.py.
    return df.withColumn("data", F.col("data"))


@register_overlay_repair(
    table="experiment_macro_data",
    issue="OJD-XXXX",
    description="Retroactive correction: gold rows already-emitted before the silver fix landed.",
    overlay_table="experiment_macro_data_repairs",
    coalesce_fields=("macro_output", "macro_error"),
)
def gold_overlay_for_historical_rows():
    pass

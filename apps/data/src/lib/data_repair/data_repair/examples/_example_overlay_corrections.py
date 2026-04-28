"""
Scenario: a one-off batch of rows needs surgical corrections that cannot be
expressed as a function (no general predicate, no algorithmic inverse).
Build a sidecar Delta table holding the corrected values keyed by row id;
the silver/gold projection LEFT JOINs and COALESCEs.

Use case: 47 rows in experiment_macro_data have wrong macro_output because
they were processed against a stale macro version, manually re-derived
offline by a researcher.

The decorated function is a marker only; the framework discovers the overlay
via `apply_overlay_repairs(table)` and the pipeline-side view DDL does the
JOIN. Populate the overlay table once via:

    INSERT INTO experiment_macro_data_repairs
      (macro_row_id, macro_output_corrected, macro_error_corrected,
       applied_by, issue, reason)
    VALUES
      (123456, parse_json('{...}'), NULL,
       'petar', 'OJD-XXXX', 'manually re-derived from raw');
"""
from ..manifest import register_overlay_repair


@register_overlay_repair(
    table="experiment_macro_data",
    issue="OJD-XXXX / GH#YYYY",
    description=(
        "Surgical corrections to historical macro_output for rows that can't "
        "be repaired by a general transform. Populate the overlay table per "
        "row; the corrected view COALESCEs over it."
    ),
    overlay_table="experiment_macro_data_repairs",
    coalesce_fields=("macro_output", "macro_error"),
)
def historical_macro_output_corrections():
    pass

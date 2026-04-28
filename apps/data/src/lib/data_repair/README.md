# data_repair

Reusable framework for patching data corruption downstream of bronze, without
mutating bronze and without full-refreshing experiment_ tables.

## When to use which pattern

Two repair patterns. Pick per incident.

### Function-based (forward protection)

For *deterministic* corruptions where the inverse can be expressed as a Spark
DataFrame transform, applied in the silver/gold projection. Best when the
corruption can still enter the pipeline (e.g. legacy clients still uploading
broken data) — the projection no-ops on already-clean rows.

```python
from data_repair import register_function_repair

@register_function_repair(
    table="experiment_raw_data",
    issue="OJD-XXX / GH#YYYY",
    description="Brief explanation of what went wrong and what the inverse does.",
)
def short_repair_name(df):
    affected = (...)  # predicate identifying corrupted rows
    return df.withColumn(
        "data",
        F.when(affected, _invert_corruption(F.col("data"))).otherwise(F.col("data")),
    )
```

Hook into the table function once per silver/gold target:

```python
from data_repair import apply_function_repairs

@dlt.table(name=EXPERIMENT_RAW_DATA_TABLE)
def experiment_raw_data():
    df = ...  # existing build
    df = apply_function_repairs(df, table_name="experiment_raw_data")
    return df
```

### Overlay-based (retroactive correction)

For corruptions where affected rows have already been emitted downstream and
the projection is streaming (no replay). Build a sidecar Delta table named
`<table>_repairs` containing corrected versions of specific rows; downstream
consumers read a `<table>_corrected` view that LEFT JOINs and COALESCEs.

```python
from data_repair import register_overlay_repair

@register_overlay_repair(
    table="experiment_macro_data",
    issue="OJD-XXX / GH#YYYY",
    description="Retroactive correction of macro_output for affected historical rows.",
    overlay_table="experiment_macro_data_repairs",
    coalesce_fields=("macro_output", "macro_error"),
)
def short_repair_name():
    pass  # marker only — view DDL lives in pipeline SQL
```

The overlay table + view DDL is owned by the pipeline (see
`apps/data/src/pipelines/sql/`) and uses
`apply_overlay_repairs(table_name)` to discover the field list.

## Examples

`data_repair/examples/` contains reference implementations for common scenarios.
Examples are NOT auto-registered (they're outside `data_repair/repairs/`), so
the default registry stays clean. Copy-paste a file into `repairs/` and add an
import line in `repairs/__init__.py` to activate it.

| File | Scenario |
| --- | --- |
| `_example_simple_field_correction.py` | Top-level scalar value remap (smallest function-based repair) |
| `_example_nested_variant_inverse.py` | Walk a nested VARIANT array and apply an algebraic inverse to specific entries (RIDES-shape) |
| `_example_clamp_invalid.py` | Sanitize out-of-range sensor values to NULL when no inverse exists |
| `_example_overlay_corrections.py` | Sidecar Delta table for surgical per-row corrections (no general predicate possible) |
| `_example_combined_forward_and_retroactive.py` | Same incident, both function-based silver protection + overlay-based gold retroactive |

## File naming

`YYYY_MM_<short_name>.py` under `data_repair/repairs/`. Helps chronological
ordering and makes the registration order obvious.

## Required metadata per repair

- `issue`: link to Linear/GitHub issue tracking the incident.
- `description`: one-line summary of corruption + inverse.
- Inline comment in the function body: the *predicate* (which rows are
  affected) and the *idempotency reasoning* (why re-application doesn't
  re-corrupt clean rows). Both belong next to the code so anyone reading it
  can audit.

## Removal policy

Function-based repairs typically stay forever. They're cheap (a `when()`
predicate that's a no-op for non-matching rows) and removing them risks
re-corrupting any new row that ever matches.

Overlay-based repairs can be deactivated by `DELETE FROM <table>_repairs WHERE ...`
or by dropping the row, when source data is independently corrected.

## Testing

Unit-test each repair function in isolation (synthetic input → expected output).
Idempotency cases worth covering:

- Apply repair to a non-matching row → identical output.
- Apply repair to a corrupted row → corrected output.
- The predicate excludes rows that have already been repaired (so re-running
  the projection on the same row doesn't re-undo).

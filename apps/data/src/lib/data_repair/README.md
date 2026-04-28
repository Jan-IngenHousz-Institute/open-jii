# data_repair

Registry of Spark transforms that fix known data corruptions inside table
projections. Bronze stays immutable; the corrupted column is rewritten on
read.

Aimed at **prod**. Repairs are usually scoped to prod-specific identifiers
(macro UUIDs, device IDs) that don't exist in dev, so the predicates no-op
there. Land and verify everything against prod data.

## Add a repair

Drop a file under `repairs/` named `_YYYY_MM_<short_name>.py` (leading
underscore so Python can import it). Decorate the transform:

```python
from pyspark.sql import functions as F
from data_repair import inline_repair

@inline_repair(
    table="experiment_macro_data",
    issue="OJD-571 / GH#1056",
    description="One-line summary of the bug and the inverse.",
)
def short_repair_name(df):
    affected = ...  # predicate
    return df.withColumn("data", F.when(affected, _invert(F.col("data"))).otherwise(F.col("data")))
```

Register the file in `repairs/__init__.py`:

```python
from . import _2026_04_short_repair_name  # noqa: F401
```

## Wire it into the pipeline

Once per target table, inside the `@dlt.table` function:

```python
from data_repair import apply_inline_repairs

@dlt.table(name=EXPERIMENT_MACRO_DATA_TABLE)
def experiment_macro_data():
    return (
        base_df
        .transform(lambda df: apply_inline_repairs(df, EXPERIMENT_MACRO_DATA_TABLE))
        # ... rest of the projection
    )
```

`apply_inline_repairs` walks the registry, runs the matching repairs in
registration order, and logs a row-count delta per repair.

## Pick the target table

If the corruption is in raw input and many downstream tables read it,
target `experiment_raw_data`. If only a derived value is wrong, target the
gold table that does the derivation (e.g. `experiment_macro_data`, just
before the macro UDF). That way you can full-refresh the gold table to
retroactively repair historical rows without touching `experiment_raw_data`.

## Severity

```python
@inline_repair(..., severity="advisory")
```

`advisory` registers the repair but skips it at apply time. Logs
`[REPAIR][advisory] <name> (<issue>): registered, not applied`. Use it to
land a new file, watch one pipeline run to confirm registration, then flip
to `"apply"` (the default).

## Notes

- Repairs run in registration order. Order matters when two repairs touch
  the same column.
- For inverses that aren't self-idempotent, gate them on a predicate that
  excludes already-corrected rows, OR rely on the streaming-append
  semantics of the target table (each row processed once).
- Repairs typically stay forever. Removing one risks re-corrupting any
  new row that ever matches. Narrow the predicate instead (e.g. add a
  `processed_timestamp` cutoff) once the upstream is fixed.
- Drop a sibling `_YYYY_MM_<short_name>.sql` next to the `.py` with two
  sections: `-- before:` queries that scope the corruption pre-deploy, and
  `-- after:` queries that confirm the repair landed (e.g. corrupted-row
  count = 0). Convention only; the framework doesn't read these. Keeps
  the verification recipe colocated with the code.

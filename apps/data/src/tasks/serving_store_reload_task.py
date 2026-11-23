# Databricks notebook source
# DBTITLE 1,Serving Store Reload
# Replaces what the serving store holds for one experiment, or for every experiment, with what its source
# holds now. Run by hand; docs/runbooks/procedures/serving-store-reload.md says when and how.

# COMMAND ----------

# DBTITLE 1,Imports and configuration
import traceback

from openjii.serving_store.reload import StoreReload
from openjii.serving_store.tables import DEVICE_EVENTS, MACRO_RESULTS, MEASUREMENTS, UPLOADS
from openjii.serving_store.writer import StoreWriter

TABLES = {table.name: table for table in (MEASUREMENTS, MACRO_RESULTS, UPLOADS, DEVICE_EVENTS)}

WIDGETS = ("CATALOG_NAME", "CENTRAL_SCHEMA", "ENVIRONMENT", "EXPERIMENT_ID", "TABLE")
for name in WIDGETS:
    dbutils.widgets.text(name, "")
dbutils.widgets.text("ALLOW_REMOVAL", "false")


def required_widget(name: str) -> str:
    value = dbutils.widgets.get(name).strip()
    if not value:
        raise ValueError(f"widget {name} is required and empty")
    return value


CATALOG_NAME = required_widget("CATALOG_NAME")
CENTRAL_SCHEMA = required_widget("CENTRAL_SCHEMA")
ENVIRONMENT = required_widget("ENVIRONMENT")
# No default, so a run without an experiment fails instead of reloading every one.
EXPERIMENT_ID = required_widget("EXPERIMENT_ID")
TABLE = required_widget("TABLE")

if TABLE != "all" and TABLE not in TABLES:
    raise ValueError(f"TABLE is {TABLE!r}; use all or one of {', '.join(TABLES)}")
# Device events reload only by name: reloaded before their sink runs, they would let device pages read
# events the feed never adds to.
tables = [table for table in TABLES.values() if table.per_experiment] if TABLE == "all" else [TABLES[TABLE]]
experiment_id = None if EXPERIMENT_ID == "all" else EXPERIMENT_ID

holds_no_experiment = TABLE != "all" and not TABLES[TABLE].per_experiment
if experiment_id is not None and holds_no_experiment:
    raise ValueError(f"TABLE {TABLE} holds no experiment's rows; reload it with EXPERIMENT_ID all")

# Lets the delete remove more than the reload's limit of rows the source no longer holds, as for a
# deleted experiment. Anything but true or false is refused, so a typo cannot pass for either.
ALLOW_REMOVAL = dbutils.widgets.get("ALLOW_REMOVAL").strip().lower()
if ALLOW_REMOVAL not in ("true", "false"):
    raise ValueError(f"ALLOW_REMOVAL is {ALLOW_REMOVAL!r}; use true or false")
allow_removal = ALLOW_REMOVAL == "true"

scope = f"serving-store-{ENVIRONMENT}"
writer = StoreWriter(
    dbutils.secrets.get(scope=scope, key="url"),
    dbutils.secrets.get(scope=scope, key="reloader-username"),
    dbutils.secrets.get(scope=scope, key="reloader-password"),
)
writer.check()

# COMMAND ----------

# DBTITLE 1,Reload
reload = StoreReload(spark, writer, f"{CATALOG_NAME}.{CENTRAL_SCHEMA}")
mismatches = []


def named(rows: dict[str, int]) -> str:
    return ", ".join(f"{experiment} ({count})" for experiment, count in list(rows.items())[:20])


for table in tables:
    # One table's failure is reported with the others' results rather than in their place.
    try:
        reloaded = reload.reload(table, experiment_id, allow_removal)
    except Exception as error:
        traceback.print_exc()
        mismatches.append(f"{table.name} failed: {type(error).__name__}: {error}")
        continue

    counted = "experiments" if table.per_experiment else "devices"
    print(
        f"[serving store] Reloaded {table.name} at {table.source_table} version {reloaded.version}: "
        f"{reloaded.written.inserted} rows sent, {reloaded.written.rejected} refused (in feed_rejects); "
        f"{sum(reloaded.source.values())} rows in {table.source_table} and {sum(reloaded.store.values())} in the store "
        f"over {len(reloaded.source)} {counted}, {sum(reloaded.newer.values())} of them written by the feed since",
        flush=True,
    )
    found_nothing = experiment_id is not None and not (reloaded.source or reloaded.store or reloaded.older)
    if found_nothing:
        print(
            f"[serving store] Neither {table.source_table} nor store.{table.name} holds experiment {experiment_id} now; "
            "unless it was deleted, check the id"
        )

    if reloaded.written.rejected:
        mismatches.append(
            f"{table.name}: the store refused {reloaded.written.rejected} rows, so nothing was deleted and their "
            "older copies stay; fix them as store-feed-rejects describes, then run the reload again"
        )
        continue
    if reloaded.schemas.rejected:
        mismatches.append(
            f"{table.name}: the store refused {reloaded.schemas.rejected} payload schemas (in feed_rejects), so "
            "the older ones stay; fix them as store-feed-rejects describes, then run the reload again"
        )
    if reloaded.missing:
        mismatches.append(
            f"{table.name} lacks {reloaded.missing} of {table.source_table}'s rows, in {named(reloaded.short)}"
        )
    if reloaded.older:
        mismatches.append(
            f"{table.name} holds rows from before version {reloaded.version} that the feed sent after the "
            f"delete, in {named(reloaded.older)}; run the reload again once the feed has caught up"
        )
    if reloaded.unmatched_copies:
        mismatches.append(
            f"the copy of {table.name} by device does not hold the captures {table.name} holds, with as many "
            f"more rows as each count says (0 when only which ones differ), in "
            f"{named(reloaded.unmatched_copies)}; run the reload again"
        )

if mismatches:
    raise RuntimeError(f"The store does not match its sources: {'; '.join(mismatches)}")

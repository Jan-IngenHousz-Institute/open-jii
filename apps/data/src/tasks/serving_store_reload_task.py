# Databricks notebook source
# DBTITLE 1,Serving Store Reload
# Replaces what the serving store holds for one experiment, or for every experiment, with what gold
# holds now. Run by hand; docs/runbooks/procedures/serving-store-reload.md says when and how.

# COMMAND ----------

# DBTITLE 1,Imports and configuration
from openjii.serving_store.reload import StoreReload
from openjii.serving_store.tables import MACRO_RESULTS, MEASUREMENTS, UPLOADS
from openjii.serving_store.writer import StoreWriter

TABLES = {table.name: table for table in (MEASUREMENTS, MACRO_RESULTS, UPLOADS)}

WIDGETS = ("CATALOG_NAME", "CENTRAL_SCHEMA", "ENVIRONMENT", "EXPERIMENT_ID", "TABLE")
for name in WIDGETS:
    dbutils.widgets.text(name, "")


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
tables = list(TABLES.values()) if TABLE == "all" else [TABLES[TABLE]]
experiment_id = None if EXPERIMENT_ID == "all" else EXPERIMENT_ID

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
    reloaded = reload.reload(table, experiment_id)
    print(
        f"[serving store] Reloaded {table.name} at gold version {reloaded.version}: "
        f"{reloaded.written.inserted} rows sent, {reloaded.written.rejected} refused (in feed_rejects); "
        f"{sum(reloaded.gold.values())} rows in gold and {sum(reloaded.store.values())} in the store "
        f"over {len(reloaded.gold)} experiments, {sum(reloaded.newer.values())} of them written by the feed since",
        flush=True,
    )
    if reloaded.missing:
        mismatches.append(f"{table.name} lacks {reloaded.missing} of gold's rows, in {named(reloaded.short)}")
    if reloaded.older:
        mismatches.append(
            f"{table.name} holds rows from before version {reloaded.version} that the feed sent after the "
            f"delete, in {named(reloaded.older)}; run the reload again once the feed has caught up"
        )

if mismatches:
    raise RuntimeError(f"The store does not match gold: {'; '.join(mismatches)}")

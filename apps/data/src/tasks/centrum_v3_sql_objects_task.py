# Databricks notebook source
# DBTITLE 1,Register centrum v3 payload SQL objects
# Registers the shared Unity Catalog functions and views for the AMBIT v3
# payload contract (ambyte-iot docs/mqtt-payload.md): trace_points, the v2
# compat normalizers, and the trace / telemetry / inventory views.
#
# Not part of the DLT pipeline on purpose. These are shared UC objects that
# dashboards, Genie and the DP pipelines call by name; a pipeline-declared view
# would not publish under those names, and a pipeline-declared table would
# materialize pulse grain nobody asked for. Every statement is CREATE OR
# REPLACE, so running this on every deploy is a no-op when nothing changed.

# COMMAND ----------
import json
import logging

from pyspark.sql import SparkSession

from openjii.trace import sql_objects

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# COMMAND ----------

# DBTITLE 1,Configuration
dbutils.widgets.text("CATALOG_NAME", "", "Catalog (e.g. open_jii_dev)")
dbutils.widgets.text("CENTRAL_SCHEMA", "centrum", "Schema holding experiment_raw_data")

CATALOG_NAME = dbutils.widgets.get("CATALOG_NAME")
CENTRAL_SCHEMA = dbutils.widgets.get("CENTRAL_SCHEMA") or "centrum"

if not CATALOG_NAME:
    raise ValueError("CATALOG_NAME is required")

spark = SparkSession.builder.getOrCreate()

# COMMAND ----------

# DBTITLE 1,Register
for filename, statement in zip(
    sql_objects.STATEMENT_FILES, sql_objects.statements(CATALOG_NAME, CENTRAL_SCHEMA)
):
    logger.info("Applying %s", filename)
    spark.sql(statement)

logger.info(
    "Registered %d functions and %d views in %s.%s",
    len(sql_objects.FUNCTIONS),
    len(sql_objects.VIEWS),
    CATALOG_NAME,
    CENTRAL_SCHEMA,
)

# COMMAND ----------

# DBTITLE 1,Verify the objects resolve
# A registered function that cannot be planned is worse than one that failed to
# create, so touch each object once. LIMIT 0 plans and resolves without scanning.
for view in sql_objects.VIEWS:
    spark.sql(f"SELECT * FROM {CATALOG_NAME}.{CENTRAL_SCHEMA}.{view} LIMIT 0").collect()

probe_payload = json.dumps(
    {
        "schema": "ambit.trace/3",
        "time": {"start_utc": 0},
        "series": {"fluo_630_signal": {"u": "count", "t0": 0, "dt": 0.854, "v": [1, 2]}},
    },
    separators=(",", ":"),
)
probe = spark.sql(
    f"SELECT count(*) AS points "
    f"FROM {CATALOG_NAME}.{CENTRAL_SCHEMA}.trace_points(parse_json('{probe_payload}'))"
).collect()[0]["points"]
assert probe == 2, f"trace_points returned {probe} points for a 2-sample series"

logger.info("All v3 SQL objects resolve")

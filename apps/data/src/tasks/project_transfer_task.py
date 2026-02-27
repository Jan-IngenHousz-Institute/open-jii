# Databricks notebook source
# DBTITLE 1,Project Transfer Job
# Validates pending transfer requests, calls the backend webhook for approved ones,
# and writes enriched measurement data as parquet into the data-imports volume
# for centrum_pipeline ingestion.

# COMMAND ----------

# DBTITLE 1,Imports
import json
import logging
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, ArrayType, BooleanType, LongType, MapType
from enrich.transfer_metadata import execute_transfers

logger = logging.getLogger(__name__)

# COMMAND ----------

# DBTITLE 1,Configuration
CATALOG_NAME = dbutils.widgets.get("catalog_name")
CENTRUM_SCHEMA = "centrum"
PHOTOSYNQ_DATA_PATH = dbutils.widgets.get("PHOTOSYNQ_DATA_PATH")
ENVIRONMENT = dbutils.widgets.get("ENVIRONMENT").lower()
VOLUME_BASE = f"/Volumes/{CATALOG_NAME}/centrum/data-imports"
TRANSFER_TABLE = f"{CATALOG_NAME}.{CENTRUM_SCHEMA}.openjii_project_transfer_requests"

# COMMAND ----------

# DBTITLE 1,Parquet Schemas

USERS_SCHEMA = StructType([
    StructField("user_id", StringType(), True),
    StructField("name", StringType(), True),
    StructField("email", StringType(), True),
    StructField("institute", StringType(), True),
    StructField("contributions", LongType(), True),
    StructField("is_creator", BooleanType(), True),
    StructField("project_ids", ArrayType(StringType()), True),
])

PROJECTS_SCHEMA = StructType([
    StructField("project_id", StringType(), True),
    StructField("name", StringType(), True),
    StructField("description", StringType(), True),
    StructField("creator_id", StringType(), True),
    StructField("created_at", StringType(), True),
    StructField("updated_at", StringType(), True),
    StructField("data_count", LongType(), True),
    StructField("contributors_count", LongType(), True),
    StructField("is_featured", BooleanType(), True),
    StructField("is_public", BooleanType(), True),
    StructField("beta", BooleanType(), True),
    StructField("protocols", StringType(), True),
    StructField("tags", ArrayType(StringType()), True),
    StructField("directions", StringType(), True),
    StructField("locations", ArrayType(StructType([
        StructField("address", StringType(), True),
        StructField("latitude", DoubleType(), True),
        StructField("longitude", DoubleType(), True),
    ])), True),
])

MEASUREMENTS_SCHEMA = StructType([
    StructField("project_id", StringType(), True),
    StructField("measurement_id", StringType(), True),
    StructField("user_id", StringType(), True),
    StructField("device_id", StringType(), True),
    StructField("status", StringType(), True),
    StructField("time", StringType(), True),
    StructField("latitude", DoubleType(), True),
    StructField("longitude", DoubleType(), True),
    StructField("note", StringType(), True),
    StructField("user_answers", MapType(StringType(), StringType()), True),
    StructField("sample_processed", StringType(), True),
    StructField("sample_raw", StringType(), True),
])

QUESTIONS_SCHEMA = StructType([
    StructField("project_id", StringType(), True),
    StructField("question_id", StringType(), True),
    StructField("label", StringType(), True),
    StructField("value_type", StringType(), True),
    StructField("options", ArrayType(StringType()), True),
])

# COMMAND ----------

# DBTITLE 1,Load Data Sources

projects = spark.read.schema(PROJECTS_SCHEMA).parquet(f"{PHOTOSYNQ_DATA_PATH}/projects.parquet")
users = spark.read.schema(USERS_SCHEMA).parquet(f"{PHOTOSYNQ_DATA_PATH}/users.parquet")
measurements = spark.read.schema(MEASUREMENTS_SCHEMA).parquet(f"{PHOTOSYNQ_DATA_PATH}/measurements")
questions = spark.read.schema(QUESTIONS_SCHEMA).parquet(f"{PHOTOSYNQ_DATA_PATH}/questions.parquet")

# COMMAND ----------

# DBTITLE 1,Validate Pending Requests
pending = spark.table(TRANSFER_TABLE).filter("status = 'pending'")
pending_count = pending.count()
logger.info(f"Pending requests: {pending_count}")

if pending_count > 0:
    validation = (
        pending.alias("t")
        .join(projects.alias("p"), F.col("t.project_id_old") == F.col("p.project_id"), "left")
        .join(users.alias("u"), F.col("p.creator_id") == F.col("u.user_id"), "left")
        .select(
            F.col("t.request_id"),
            F.when(F.col("p.project_id").isNull(), F.lit("failed"))
            .when(
                F.lower(F.col("u.email")) == F.lower(F.col("t.user_email")),
                F.lit("approved"),
            )
            .otherwise(F.lit("rejected"))
            .alias("new_status"),
        )
    )
    validation.createOrReplaceTempView("_validation_results")
    spark.sql(f"""
        MERGE INTO {TRANSFER_TABLE} t
        USING _validation_results v ON t.request_id = v.request_id
        WHEN MATCHED THEN UPDATE SET t.status = v.new_status
    """)
    for row in validation.collect():
        logger.info(f"  {row.request_id}: {row.new_status}")

# COMMAND ----------

# DBTITLE 1,Load Approved Requests

requests = spark.table(TRANSFER_TABLE).filter(F.col("status") == "approved")

if requests.count() == 0:
    logger.info("No approved requests to process")
    dbutils.notebook.exit(json.dumps({"status": "success", "transfers": []}))

# COMMAND ----------

# DBTITLE 1,Project Metadata
questions_per_project = questions.groupBy("project_id").agg(
    F.collect_list(
        F.struct(
            F.col("question_id"),
            F.col("label").alias("question_text"),
            F.col("value_type"),
            F.col("options"),
        )
    ).alias("questions")
)

metadata = (
    requests.alias("tr")
    .join(projects.alias("p"), F.col("tr.project_id_old") == F.col("p.project_id"), "inner")
    .join(questions_per_project.alias("q"), F.col("p.project_id") == F.col("q.project_id"), "left")
    .select(
        F.col("tr.request_id").alias("transfer_id"),
        F.col("p.project_id"),
        F.col("p.name"),
        F.col("p.description"),
        F.col("p.is_public"),
        F.col("p.creator_id"),
        F.col("tr.user_id").alias("creator_user_id"),
        F.coalesce(F.col("q.questions"), F.array()).alias("questions"),
        F.col("p.locations"),
    )
)

# COMMAND ----------

# DBTITLE 1,Project Protocols & Macros
protocols_parsed = (
    projects
    .filter(F.col("protocols").isNotNull())
    .select(
        F.col("project_id"),
        F.explode(F.expr("from_json(protocols, 'ARRAY<STRING>')")).alias("proto_raw"),
    )
    .select(
        F.col("project_id"),
        F.expr("parse_json(proto_raw)").alias("proto"),
    )
)

protocols_exploded = protocols_parsed.selectExpr(
    "project_id",
    "proto:id::BIGINT as protocol_id_old",
    "proto:name::STRING as name",
    "proto:description::STRING as description",
    "proto:protocol_json::STRING as code",
)

protocols = (
    metadata.alias("m")
    .join(protocols_exploded.alias("pr"), F.col("m.project_id") == F.col("pr.project_id"), "inner")
    .select(
        F.col("m.transfer_id"),
        F.col("m.project_id"),
        F.col("m.creator_user_id"),
        F.col("pr.protocol_id_old"),
        F.col("pr.name"),
        F.col("pr.description"),
        F.col("pr.code"),
        F.lit("multispeq").alias("family"),
    )
)

macros_exploded = (
    protocols_parsed
    .filter(F.expr("proto:macro IS NOT NULL"))
    .selectExpr(
        "project_id",
        "proto:id::BIGINT as protocol_id_old",
        "proto:macro_id::BIGINT as macro_id_old",
        "proto:macro:name::STRING as name",
        "proto:macro:description::STRING as description",
        "proto:macro:javascript_code::STRING as code",
    )
)

macros = (
    metadata.alias("m")
    .join(macros_exploded.alias("mc"), F.col("m.project_id") == F.col("mc.project_id"), "inner")
    .select(
        F.col("m.transfer_id"),
        F.col("m.project_id"),
        F.col("m.creator_user_id"),
        F.col("mc.protocol_id_old"),
        F.col("mc.macro_id_old"),
        F.col("mc.name"),
        F.col("mc.description"),
        F.lit("javascript").alias("language"),
        F.col("mc.code"),
    )
)

# COMMAND ----------

# DBTITLE 1,Project Data
questions_map = questions.groupBy("project_id").agg(
    F.map_from_arrays(
        F.collect_list("question_id"),
        F.collect_list("label"),
    ).alias("question_labels")
)

project_data = (
    requests.alias("tr")
    .join(measurements.alias("m"), F.col("tr.project_id_old") == F.col("m.project_id"), "inner")
    .join(questions_map.alias("ql"), F.col("m.project_id") == F.col("ql.project_id"), "left")
    .select(
        F.col("m.measurement_id").alias("id"),
        F.col("m.device_id"),
        F.lit(None).cast("string").alias("device_name"),
        F.lit(None).cast("string").alias("device_version"),
        F.lit(None).cast("double").alias("device_battery"),
        F.lit(None).cast("string").alias("device_firmware"),
        F.col("m.sample_raw").alias("sample"),
        F.col("m.sample_processed").alias("output"),
        F.lit(None).cast("string").alias("user_id"),
        F.lit(None).cast("string").alias("experiment_id"),
        F.lit(None).cast("string").alias("protocol_id"),
        F.lit(None).cast("string").alias("macro_id"),
        F.lit(None).cast("string").alias("macro_filename"),
        # PhotosynQ `time` is Unix epoch in milliseconds; divide by 1000 to get seconds
        (F.col("m.time").cast("double") / 1000).cast("timestamp").alias("timestamp"),
        F.to_date((F.col("m.time").cast("double") / 1000).cast("timestamp")).cast("string").alias("date"),
        F.when(
            F.col("m.user_answers").isNotNull() & (F.size("m.user_answers") > 0),
            F.expr("""
                to_json(
                    transform(
                        map_keys(user_answers),
                        key -> named_struct(
                            'question_label', coalesce(question_labels[key], key),
                            'question_text', coalesce(question_labels[key], key),
                            'question_answer', user_answers[key]
                        )
                    )
                )
            """),
        ).alias("questions"),
        F.col("tr.request_id").alias("transfer_request_id"),
        F.lit("photosynq").alias("source_platform"),
    )
)

# COMMAND ----------

# DBTITLE 1,Backend Transfer
protocols_agg = protocols.groupBy("transfer_id").agg(
    F.collect_list(
        F.struct(F.col("name"), F.col("description"), F.col("code"), F.col("family"))
    ).alias("protocols_list")
)

macros_agg = macros.groupBy("transfer_id").agg(
    F.collect_list(
        F.struct(F.col("name"), F.col("description"), F.col("language"), F.col("code"))
    ).alias("macros_list")
)

transfers = (
    metadata.alias("m")
    .join(protocols_agg.alias("p"), F.col("m.transfer_id") == F.col("p.transfer_id"), "left")
    .join(macros_agg.alias("mc"), F.col("m.transfer_id") == F.col("mc.transfer_id"), "left")
    .select(
        F.col("m.transfer_id"),
        F.col("m.project_id"),
        F.col("m.name").alias("project_name"),
        F.col("m.description").alias("project_description"),
        F.col("m.creator_user_id"),
        F.col("m.questions"),
        F.col("m.locations"),
        F.col("p.protocols_list"),
        F.col("mc.macros_list"),
    )
)

transfer_results = execute_transfers(transfers, ENVIRONMENT, dbutils, spark)

# COMMAND ----------

# DBTITLE 1,Write Import Data to Volume
successful = transfer_results.filter(F.col("success") == True)

enriched = (
    project_data.alias("d")
    .join(successful.alias("r"), F.col("d.transfer_request_id") == F.col("r.transfer_id"), "inner")
    .select(
        F.col("d.id"),
        F.col("d.device_id"),
        F.col("d.device_name"),
        F.col("d.device_version"),
        F.col("d.device_battery"),
        F.col("d.device_firmware"),
        F.col("d.sample"),
        F.col("d.output"),
        F.col("d.user_id"),
        F.col("r.experiment_id"),
        F.col("r.protocol_id"),
        F.col("r.macro_id"),
        F.col("r.macro_filename"),
        F.col("d.timestamp"),
        F.col("d.date"),
        F.col("d.questions"),
        F.col("d.transfer_request_id"),
        F.col("d.source_platform"),
    )
)

for row in successful.select("experiment_id", "transfer_id").collect():
    experiment_id = row["experiment_id"]
    transfer_id = row["transfer_id"]
    output_path = f"{VOLUME_BASE}/{experiment_id}/photosynq_transfer"
    enriched.filter(F.col("experiment_id") == experiment_id).write.mode("overwrite").parquet(output_path)
    logger.info(f"Wrote import data to {output_path}")

# Bulk-update transfer statuses (completed + failed) via MERGE
status_updates = transfer_results.select(
    F.col("transfer_id").alias("request_id"),
    F.when(F.col("success") == True, F.lit("completed"))
    .otherwise(F.lit("failed"))
    .alias("new_status"),
)
status_updates.createOrReplaceTempView("_status_updates")
spark.sql(f"""
    MERGE INTO {TRANSFER_TABLE} t
    USING _status_updates u ON t.request_id = u.request_id
    WHEN MATCHED THEN UPDATE SET t.status = u.new_status
""")

for row in successful.select("transfer_id").collect():
    logger.info(f"  {row['transfer_id']}: completed")
for row in transfer_results.filter(F.col("success") == False).select("transfer_id", "error").collect():
    error_msg = row["error"] or "Unknown error"
    logger.info(f"  {row['transfer_id']}: failed - {error_msg}")

# COMMAND ----------

# DBTITLE 1,Output
output = {
    "status": "success",
    "transfers": [row.asDict() for row in transfer_results.collect()],
}

logger.info(json.dumps(output, indent=2))
dbutils.notebook.exit(json.dumps(output))

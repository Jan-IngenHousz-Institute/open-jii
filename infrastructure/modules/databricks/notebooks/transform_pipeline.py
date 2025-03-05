# Databricks notebook source
# MAGIC %md
# MAGIC # Sensor Data Transformation Pipeline (Per Experiment)
# MAGIC 
# MAGIC This notebook moves sensor data from the central bronze table into an experiment‐specific schema.
# MAGIC It is designed to be triggered with an argument (experiment_id) and to process only new data.
# MAGIC 
# MAGIC ## High-Level Steps
# MAGIC 1. Read the "experiment_id" argument (and derive target schema if needed).
# MAGIC 2. Read central bronze data filtered by experiment_id.
# MAGIC 3. Exclude records already moved based on a unique key (e.g. kinesis_sequence_number).
# MAGIC 4. Write new records into the experiment-specific Bronze table.
# MAGIC 5. Perform Silver and Gold transformations as needed.
# MAGIC 
# MAGIC *Note: Adjust key names and transformation logic as required.*

# COMMAND ----------

# MAGIC %md
# MAGIC ## Configuration and Parameter Initialization

# COMMAND ----------

import dlt
from pyspark.sql import functions as F, SparkSession, Window

# In Databricks, "spark" is already available
# Create a widget to supply the experiment_id; you could also add a widget for target_schema if needed.
dbutils.widgets.text("experiment_id", "", "Experiment ID")
target_experiment = dbutils.widgets.get("experiment_id")
if target_experiment == "":
  raise Exception("A non-empty experiment_id must be provided.")

# For simplicity, we assume target schema is the same as experiment_id.
target_schema = target_experiment

# Define catalog and central schema/table names (adjust as needed)
CATALOG_NAME = "agriculture_sensors"
CENTRAL_SCHEMA = "central"
CENTRAL_BRONZE_TABLE = "raw_data"  # Our source table from the central intake

# Unique key to identify records (adjust if needed)
UNIQUE_KEY = "kinesis_sequence_number"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Experiment-Specific Bronze Table
# MAGIC 
# MAGIC This table reads records for the target experiment from the central bronze table,
# MAGIC but it removes rows that were already moved based on the unique key.
# MAGIC 
# MAGIC (If the destination table does not yet exist, all records are new.)

# COMMAND ----------

@dlt.table(
  name=lambda: f"{target_experiment}_bronze",
  schema=target_schema,
  comment=lambda: f"Raw sensor data for experiment {target_experiment} (new records only)"
)
def experiment_bronze():
  """
  Read sensor data from the central Bronze table filtered by experiment_id.
  Exclude any records whose unique key already exists in the destination.
  """
  # Read the central bronze table
  central_df = dlt.read(f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{CENTRAL_BRONZE_TABLE}") \
                 .filter(F.col("experiment_id") == target_experiment)
  
  # Try to read already moved records from the destination table.
  try:
      existing_df = spark.table(f"{CATALOG_NAME}.{target_schema}.{target_experiment}_bronze")
  except Exception:
      existing_df = None

  if existing_df is not None:
      # Exclude records that have been processed by left anti join using UNIQUE_KEY
      new_records = central_df.join(
          existing_df.select(UNIQUE_KEY),
          on=UNIQUE_KEY,
          how="left_anti"
      )
  else:
      new_records = central_df

  return new_records

# COMMAND ----------

# MAGIC %md
# MAGIC ## Experiment-Specific Silver Table
# MAGIC 
# MAGIC This layer performs standard cleaning and enrichment.
# MAGIC (Customize the logic as needed.)

# COMMAND ----------

@dlt.table(
  name=lambda: f"{target_experiment}_silver",
  schema=target_schema,
  comment=lambda: f"Cleaned sensor data for experiment {target_experiment}"
)
def experiment_silver():
  """
  Transform experiment bronze data by cleaning and enriching sensor readings.
  """
  bronze_df = dlt.read(f"{target_experiment}_bronze")
  return ( bronze_df
           .withColumn("clean_reading", F.when(F.col("reading_value") > 0, F.col("reading_value")).otherwise(None))
           .withColumn("event_date", F.to_date("kinesis_timestamp"))
           # ... additional transformations ...
         )

# COMMAND ----------

# MAGIC %md
# MAGIC ## Experiment-Specific Gold Table
# MAGIC 
# MAGIC This layer aggregates the clean data for analytics.
# MAGIC (Customize aggregations as needed.)

# COMMAND ----------

@dlt.table(
  name=lambda: f"{target_experiment}_gold",
  schema=target_schema,
  comment=lambda: f"Aggregated analytics-ready data for experiment {target_experiment}"
)
def experiment_gold():
  """
  Aggregate experiment silver data to compute analytics metrics.
  """
  silver_df = dlt.read(f"{target_experiment}_silver")
  return ( silver_df
           .groupBy("event_date", "device_id")
           .agg(
             F.count("*").alias("record_count"),
             F.avg("clean_reading").alias("avg_reading"),
             F.min("clean_reading").alias("min_reading"),
             F.max("clean_reading").alias("max_reading")
           )
         )

# COMMAND ----------

# MAGIC %md
# MAGIC ## Summary
# MAGIC 
# MAGIC This pipeline uses a widget-supplied experiment_id to move only new sensor records from the central bronze table into the designated experiment schema.
# MAGIC The process is idempotent since it excludes records already present in the destination.

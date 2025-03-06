# Databricks notebook source
# MAGIC %md
# MAGIC # Sensor Data Transformation Pipeline
# MAGIC 
# MAGIC This notebook implements:
# MAGIC 1. Data transformation from Bronze → Silver → Gold within the central schema
# MAGIC 2. Experiment-specific data routing from central schema to experiment schemas
# MAGIC 
# MAGIC ## Architecture
# MAGIC - **Source**: Central Bronze layer (`centrum.raw_data`)
# MAGIC - **Destinations**: 
# MAGIC   - Central Silver (`centrum.clean_data`) and Gold (`centrum.analytics_data`) layers
# MAGIC   - Experiment-specific schemas (e.g., `exp_amsterdam_2023_tulips`)
# MAGIC - **Processing**: Batch-based DLT pipeline with quality controls

# COMMAND ----------

# MAGIC %md
# MAGIC ## Configuration

# COMMAND ----------

# DBTITLE 1,Pipeline Configuration
import dlt
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from datetime import datetime, timedelta

# Define constants
CATALOG_NAME = "open_jii_dev"
CENTRAL_SCHEMA = "centrum"
BRONZE_TABLE = "raw_data"
SILVER_TABLE = "clean_data"
GOLD_TABLE = "analytics_data"

# Create widgets for parameterization
dbutils.widgets.text("experiment_id", "", "Experiment ID")
dbutils.widgets.text("target_schema", "", "Target Schema")
dbutils.widgets.text("processing_date", "", "Processing Date (YYYY-MM-DD)")

# Get parameter values
target_experiment = dbutils.widgets.get("experiment_id")
target_schema = dbutils.widgets.get("target_schema") or target_experiment
processing_date = dbutils.widgets.get("processing_date") or datetime.now().strftime("%Y-%m-%d")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Central Schema Silver Layer Processing

# COMMAND ----------

@dlt.table(
  name=SILVER_TABLE,
  schema=CENTRAL_SCHEMA,
  comment="Silver layer: Cleaned and validated sensor data in the central schema."
)
def central_silver():
  """
  Transform raw sensor data into cleaned, validated records.
  Apply quality checks and standardize values.
  """
  return (
    # Read from bronze layer
    dlt.read(f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{BRONZE_TABLE}")
    # Basic cleaning operations
    .withColumn("sensor_id", 
                F.when(F.col("sensor_id").isNotNull(), F.col("sensor_id"))
                 .otherwise(F.col("device_id")))
    .withColumn("value", F.col("measurement_value"))
    # Apply quality checks
    .withColumn("quality_check_passed", 
                (F.col("value").isNotNull() & 
                 (F.col("value") > -1000) & 
                 (F.col("value") < 1000) &
                 F.col("sensor_id").isNotNull() &
                 F.col("timestamp").isNotNull()))
    # Add processing metadata
    .withColumn("processed_timestamp", F.current_timestamp())
    # Select the fields matching our Silver schema
    .select(
      "sensor_id",
      "timestamp",
      "value", 
      "experiment_id",
      "quality_check_passed",
      "processed_timestamp"
    )
  )

# COMMAND ----------

# MAGIC %md
# MAGIC ## Central Schema Gold Layer Processing

# COMMAND ----------

@dlt.table(
  name=GOLD_TABLE,
  schema=CENTRAL_SCHEMA,
  comment="Gold layer: Analytics-ready aggregated metrics in the central schema."
)
def central_gold():
  """
  Aggregate cleaned data into analytics-ready metrics.
  Compute daily statistics by sensor and experiment.
  """
  return (
    # Read from silver layer
    dlt.read(f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{SILVER_TABLE}")
    # Filter for quality data
    .filter(F.col("quality_check_passed") == True)
    # Group by date, sensor, and experiment
    .withColumn("date", F.to_date("timestamp"))
    .groupBy("date", "sensor_id", "experiment_id")
    .agg(
      F.min("value").alias("min_value"),
      F.max("value").alias("max_value"),
      F.avg("value").alias("avg_value"),
      F.count("*").alias("reading_count")
    )
  )

# COMMAND ----------

# MAGIC %md
# MAGIC ## Experiment-Specific Data Routing
# MAGIC 
# MAGIC The following section handles routing data to experiment-specific schemas.
# MAGIC This will only execute when an experiment_id is provided.

# COMMAND ----------

# Only execute experiment-specific processing when target_experiment is provided
if target_experiment and target_schema:
  
  # COMMAND ----------
  
  @dlt.table(
    name=f"{target_experiment}_bronze",
    schema=target_schema,
    comment=f"Bronze layer: Raw sensor data for experiment {target_experiment}"
  )
  def experiment_bronze():
    """
    Extract experiment-specific data from the central bronze layer.
    """
    # Get the central bronze data for this experiment
    return (
      dlt.read(f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{BRONZE_TABLE}")
      .filter(F.col("experiment_id") == target_experiment)
    )
  
  # COMMAND ----------
  
  @dlt.table(
    name="clean_data_exp",
    schema=target_schema,
    comment=f"Silver layer: Cleaned sensor data for experiment {target_experiment}"
  )
  def experiment_silver():
    """
    Create experiment-specific silver layer with additional experiment-specific processing.
    """
    # Start with central silver data for this experiment
    return (
      dlt.read(f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{SILVER_TABLE}")
      .filter(F.col("experiment_id") == target_experiment)
      # Add experiment-specific flags or transformations
      .withColumn("experiment_specific_flag", 
                 F.lit(f"Processed for {target_experiment}"))
      # Select columns matching the experiment-specific silver schema
      .select(
        "sensor_id",
        "timestamp",
        "value",
        "experiment_id",
        "quality_check_passed",
        "experiment_specific_flag",
        "processed_timestamp"
      )
    )
  
  # COMMAND ----------
  
  @dlt.table(
    name="analytics_data_exp",
    schema=target_schema,
    comment=f"Gold layer: Analytics-ready data for experiment {target_experiment}"
  )
  def experiment_gold():
    """
    Create experiment-specific gold layer with experiment-specific metrics.
    """
    # Start with experiment-specific silver data
    silver_data = dlt.read(f"clean_data_exp")
    
    # Calculate experiment-specific metrics
    return (
      silver_data
      .filter(F.col("quality_check_passed") == True)
      .withColumn("date", F.to_date("timestamp"))
      .groupBy("date", "sensor_id", "experiment_id")
      .agg(
        F.min("value").alias("min_value"),
        F.max("value").alias("max_value"),
        F.avg("value").alias("avg_value"),
        F.count("*").alias("reading_count"),
        # Experiment-specific metric (example: daily standard deviation)
        F.stddev("value").alias("experiment_specific_metric")
      )
    )

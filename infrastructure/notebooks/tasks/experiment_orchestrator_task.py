# Databricks notebook source
# DBTITLE 1,OpenJII Experiment Pipeline Orchestrator
# This notebook reads the experiment registry and dynamically manages experiment-specific pipelines

import pyspark.sql.functions as F
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.pipelines import NotebookLibrary, PipelineLibrary, PipelineCluster
from datetime import datetime

# COMMAND ----------

# DBTITLE 1,Configuration
# Set up configuration - these could be passed as parameters
CATALOG_NAME = dbutils.widgets.get("catalog_name")
CENTRAL_SCHEMA = dbutils.widgets.get("central_schema")
EXPERIMENT_PIPELINE_PATH = dbutils.widgets.get("experiment_pipeline_path")
EXPERIMENTS_TABLE = f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.experiments"

# Initialize Databricks SDK client
w = WorkspaceClient()

# COMMAND ----------

# DBTITLE 1,Get Active Experiments
def get_active_experiments():
    """
    Query experiments table to find active experiments.
    Returns a DataFrame with experiment details for active experiments.
    """
    # Simple query for active experiments - no state tracking
    return spark.table(EXPERIMENTS_TABLE) \
        .filter(F.col("status") == "active") \
        .select(
            "experiment_id", 
            "experiment_name", 
            "schema_name"
        )

# COMMAND ----------

# DBTITLE 1,Ensure Pipeline Exists
def ensure_pipeline_exists(experiment_id, experiment_name, schema_name):
    """
    Ensures a pipeline exists for the given experiment, creating it if necessary.
    Returns the pipeline ID.
    """
    # Check if pipeline already exists
    pipeline_name = f"{experiment_id}-DLT-Pipeline-DEV"
    try:
        # Convert the iterator to a list
        existing_pipelines = list(w.pipelines.list_pipelines())
        
        for pipeline in existing_pipelines:
            if pipeline.name == pipeline_name:
                print(f"Pipeline already exists for experiment {experiment_id}")
                return pipeline.pipeline_id
    except Exception as e:
        print(f"Error listing pipelines: {str(e)}")
        raise
    
    # Pipeline doesn't exist, create it
    print(f"Creating new pipeline for experiment {experiment_id}")

    notebook_library = NotebookLibrary(path=EXPERIMENT_PIPELINE_PATH)
    library = PipelineLibrary(notebook=notebook_library)
    cluster = PipelineCluster(label="default", node_type_id="m5d.large", num_workers=1)
    
    try:
        # Create the pipeline according to SDK documentation
        response = w.pipelines.create(
            name=pipeline_name,
            target=schema_name,
            catalog=CATALOG_NAME,
            libraries=[library],
            configuration={
                "EXPERIMENT_ID": experiment_id,
                "EXPERIMENT_SCHEMA": schema_name,
                "CENTRAL_SCHEMA": CENTRAL_SCHEMA,
                "CENTRAL_SILVER_TABLE": "clean_data",
                "pipeline.name": pipeline_name
            },
            continuous=True,  # Set to continuous mode
            development=True,
            clusters=[cluster]
        )
        return response.pipeline_id
    except Exception as e:
        print(f"Error creating pipeline: {str(e)}")
        raise

# COMMAND ----------

# DBTITLE 1,Trigger Pipeline Execution
def trigger_pipeline(pipeline_id):
    """
    Triggers an update for the specified pipeline.
    """
    try:
        print(f"Triggering pipeline {pipeline_id}")
        w.pipelines.start_update(pipeline_id=pipeline_id)
    except Exception as e:
        print(f"Error triggering pipeline {pipeline_id}: {str(e)}")
        raise

# COMMAND ----------

# DBTITLE 1,Main Orchestration Logic
# Get active experiments
active_experiments = get_active_experiments().collect()
print(f"Found {len(active_experiments)} active experiments")

# Process each experiment
for exp in active_experiments:
    experiment_id = exp.experiment_id
    experiment_name = exp.experiment_name
    schema_name = exp.schema_name
    
    try:
        # Ensure pipeline exists and get its ID
        pipeline_id = ensure_pipeline_exists(experiment_id, experiment_name, schema_name)
        
        # Trigger the pipeline
        trigger_pipeline(pipeline_id)
        
        print(f"Successfully triggered pipeline for experiment {experiment_id}")
    except Exception as e:
        print(f"Error processing experiment {experiment_id}: {str(e)}")
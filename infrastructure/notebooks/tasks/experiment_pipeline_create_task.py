# Databricks notebook source
# DBTITLE 1,OpenJII Individual Experiment Pipeline Creator
# This notebook creates a cost-optimized pipeline for a specific experiment and triggers its initial execution

import pyspark.sql.functions as F
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.pipelines import NotebookLibrary, PipelineLibrary, PipelineCluster
from datetime import datetime

# COMMAND ----------

# DBTITLE 1,Configuration and Parameters
# Get parameters from widget inputs
EXPERIMENT_ID = dbutils.widgets.get("experiment_id")
EXPERIMENT_NAME = dbutils.widgets.get("experiment_name")
CATALOG_NAME = dbutils.widgets.get("catalog_name")
CENTRAL_SCHEMA = dbutils.widgets.get("central_schema")
EXPERIMENT_PIPELINE_PATH = dbutils.widgets.get("experiment_pipeline_path")

# Validate required parameters
if not EXPERIMENT_ID:
    raise ValueError("experiment_id parameter is required")
if not EXPERIMENT_NAME:
    raise ValueError("experiment_name parameter is required")

# Derive schema name from experiment ID
EXPERIMENT_SCHEMA = f"experiment_{EXPERIMENT_ID}_schema"

# Initialize Databricks SDK client
w = WorkspaceClient()

print(f"Creating pipeline for experiment: {EXPERIMENT_ID} ({EXPERIMENT_NAME})")
print(f"Target schema: {EXPERIMENT_SCHEMA}")

# COMMAND ----------

# DBTITLE 1,Check if Pipeline Already Exists
def check_existing_pipeline(experiment_id):
    """
    Check if a pipeline already exists for the given experiment.
    Returns the pipeline ID if found, None otherwise.
    """
    pipeline_name = f"{experiment_id}-DLT-Pipeline-DEV"
    
    try:
        # Convert the iterator to a list and search for existing pipeline
        existing_pipelines = list(w.pipelines.list_pipelines())
        
        for pipeline in existing_pipelines:
            if pipeline.name == pipeline_name:
                print(f"Pipeline already exists for experiment {experiment_id}: {pipeline.pipeline_id}")
                return pipeline.pipeline_id
                
        print(f"No existing pipeline found for experiment {experiment_id}")
        return None
        
    except Exception as e:
        print(f"Error checking existing pipelines: {str(e)}")
        raise

# COMMAND ----------

# DBTITLE 1,Create Cost-Optimized Pipeline
def create_experiment_pipeline(experiment_id, experiment_name, schema_name):
    """
    Creates a cost-optimized, manually triggered pipeline for the experiment.
    Returns the pipeline ID.
    """
    pipeline_name = f"{experiment_id}-DLT-Pipeline-DEV"
    
    print(f"Creating cost-optimized pipeline: {pipeline_name}")

    # Configure notebook library
    notebook_library = NotebookLibrary(path=EXPERIMENT_PIPELINE_PATH)
    library = PipelineLibrary(notebook=notebook_library)
    
    # Cost-optimized cluster configuration
    # Using smaller node type and minimal workers for cost efficiency
    cluster = PipelineCluster(
        label="default", 
        node_type_id="i3.xlarge",  # Cost-optimized node type
        num_workers=1,  # Minimal workers
        autoscale=None  # Disable autoscaling for predictable costs
    )
    
    try:
        # Create the pipeline with cost-optimized settings
        response = w.pipelines.create(
            name=pipeline_name,
            target=schema_name,
            catalog=CATALOG_NAME,
            libraries=[library],
            configuration={
                "EXPERIMENT_ID": experiment_id,
                "EXPERIMENT_NAME": experiment_name,
                "EXPERIMENT_SCHEMA": schema_name,
                "CENTRAL_SCHEMA": CENTRAL_SCHEMA,
                "CENTRAL_SILVER_TABLE": "clean_data",
                "pipeline.name": pipeline_name
            },
            continuous=False,  # Manual triggering only - not continuous
            development=True,  # Development mode for cost optimization
            clusters=[cluster],
            # Cost optimization settings
            edition="CORE",  # Use Core edition for lower costs
            channel="CURRENT"  # Use current channel
        )
        
        pipeline_id = response.pipeline_id
        print(f"Successfully created pipeline: {pipeline_id}")
        return pipeline_id
        
    except Exception as e:
        print(f"Error creating pipeline: {str(e)}")
        raise

# COMMAND ----------

# DBTITLE 1,Trigger Initial Pipeline Execution
def trigger_initial_execution(pipeline_id, experiment_id):
    """
    Triggers the initial execution of the newly created pipeline.
    """
    try:
        print(f"Triggering initial execution for pipeline {pipeline_id} (experiment {experiment_id})")
        
        # Start the pipeline update
        update_response = w.pipelines.start_update(pipeline_id=pipeline_id)
        update_id = update_response.update_id
        
        print(f"Pipeline update started with ID: {update_id}")
        print("Pipeline will automatically terminate after completion due to non-continuous mode")
        
        return update_id
        
    except Exception as e:
        print(f"Error triggering initial pipeline execution: {str(e)}")
        raise

# COMMAND ----------

# DBTITLE 1,Main Execution Logic
try:
    # Check if pipeline already exists
    existing_pipeline_id = check_existing_pipeline(EXPERIMENT_ID)
    
    if existing_pipeline_id:
        print(f"Using existing pipeline: {existing_pipeline_id}")
        pipeline_id = existing_pipeline_id
        
        # Ask user if they want to trigger the existing pipeline
        print("Pipeline already exists. Triggering execution...")
        trigger_initial_execution(pipeline_id, EXPERIMENT_ID)
        
    else:
        # Create new cost-optimized pipeline
        pipeline_id = create_experiment_pipeline(EXPERIMENT_ID, EXPERIMENT_NAME, EXPERIMENT_SCHEMA)
        
        # Trigger initial execution
        update_id = trigger_initial_execution(pipeline_id, EXPERIMENT_ID)
        
        print(f"\n=== Pipeline Creation Summary ===")
        print(f"Experiment ID: {EXPERIMENT_ID}")
        print(f"Experiment Name: {EXPERIMENT_NAME}")
        print(f"Pipeline ID: {pipeline_id}")
        print(f"Initial Update ID: {update_id}")
        print(f"Target Schema: {EXPERIMENT_SCHEMA}")
        print("=== Cost Optimization Features ===")
        print("✓ Non-continuous mode (manual triggering only)")
        print("✓ Cost-optimized node type (i3.xlarge)")
        print("✓ Minimal worker count (1)")
        print("✓ Development mode enabled")
        print("✓ Core edition for lower costs")
        print("✓ Auto-termination after completion")
        
except Exception as e:
    print(f"Failed to create/trigger experiment pipeline: {str(e)}")
    raise

# COMMAND ----------

# DBTITLE 1,Pipeline Status Check (Optional)
def check_pipeline_status(pipeline_id):
    """
    Optional function to check the current status of the pipeline.
    """
    try:
        pipeline_info = w.pipelines.get(pipeline_id=pipeline_id)
        print(f"\nPipeline Status: {pipeline_info.state}")
        
        # Get latest update info if available
        updates = list(w.pipelines.list_updates(pipeline_id=pipeline_id))
        if updates:
            latest_update = updates[0]  # Most recent update
            print(f"Latest Update State: {latest_update.state}")
            print(f"Update ID: {latest_update.update_id}")
            
    except Exception as e:
        print(f"Error checking pipeline status: {str(e)}")

# Optionally check status after creation
if 'pipeline_id' in locals():
    check_pipeline_status(pipeline_id)
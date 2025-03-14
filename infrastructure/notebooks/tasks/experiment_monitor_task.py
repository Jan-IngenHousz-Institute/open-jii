# DBTITLE 1,OpenJII Experiment Pipeline Monitor
# This notebook monitors experiment pipelines and updates their status

import pyspark.sql.functions as F
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.pipelines import UpdateInfoState
from datetime import datetime
import time

# COMMAND ----------

# DBTITLE 1,Configuration
CATALOG_NAME = dbutils.widgets.get("catalog_name")
CENTRAL_SCHEMA = dbutils.widgets.get("central_schema")
EXPERIMENTS_TABLE = f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.experiments"

# Initialize Databricks SDK client
w = WorkspaceClient()

# COMMAND ----------

# DBTITLE 1,Monitor Pipelines
def monitor_experiment_pipelines():
    """
    Check if recently triggered pipelines started successfully.
    Fail the job if any pipeline failed to start or encountered errors.
    """
    print("Starting experiment pipeline monitor...")
    
    # Get all experiments in "processing" state
    processing_exps = spark.sql(f"""
        SELECT experiment_id, experiment_name
        FROM {EXPERIMENTS_TABLE}
        WHERE status = 'processing'
    """).collect()
    
    if not processing_exps:
        print("No pipelines are in processing state. Nothing to monitor.")
        return
        
    # Store pipeline information for each experiment
    experiment_pipelines = {}
    failed_pipelines = []
    
    # Find pipelines for each experiment
    for exp in processing_exps:
        experiment_id = exp.experiment_id
        pipeline_name = f"{experiment_id}-DLT-Pipeline"
        
        # Get pipeline status
        pipelines = list(w.pipelines.list_pipelines(filter=f"name LIKE '{pipeline_name}'"))
        if not pipelines:
            print(f"No pipeline found for experiment {experiment_id}")
            failed_pipelines.append(f"Missing pipeline for {experiment_id}")
            continue
            
        pipeline = pipelines[0]
        experiment_pipelines[experiment_id] = {
            'pipeline_id': pipeline.pipeline_id,
            'pipeline_name': pipeline_name
        }
        print(f"Found pipeline {pipeline_name} for experiment {experiment_id}")
    
    # If no pipelines were found, report failure
    if not experiment_pipelines:
        if failed_pipelines:
            raise Exception(f"No matching pipelines found: {', '.join(failed_pipelines)}")
        return
        
    # Check initial status of each pipeline
    for experiment_id, pipeline_info in experiment_pipelines.items():
        pipeline_id = pipeline_info['pipeline_id']
        pipeline_name = pipeline_info['pipeline_name']
        
        try:
            # Get the latest update for the pipeline
            updates_response = w.pipelines.list_updates(pipeline_id)
            
            if not updates_response.updates or len(updates_response.updates) == 0:
                print(f"No updates found for pipeline {pipeline_name}")
                failed_pipelines.append(f"No updates for {pipeline_name}")
                continue
                
            # Get the most recent update
            latest_update = updates_response.updates[0]
            current_state = latest_update.state
            
            print(f"Pipeline {pipeline_name} is in state: {current_state}")
            
            # Check for error states
            if current_state in [UpdateInfoState.FAILED, UpdateInfoState.CANCELED]:
                error_message = f"Pipeline {pipeline_name} is in error state: {current_state}"
                print(error_message)
                failed_pipelines.append(error_message)
            
            # Mark experiment as active when pipeline is running
            elif current_state in [UpdateInfoState.RUNNING, UpdateInfoState.COMPLETED]:
                spark.sql(f"""
                    UPDATE {EXPERIMENTS_TABLE}
                    SET status = 'active' 
                    WHERE experiment_id = '{experiment_id}' AND status = 'processing'
                """)
                print(f"Marked experiment {experiment_id} as active")
                
        except Exception as e:
            error = f"Error checking pipeline {pipeline_name}: {str(e)}"
            print(error)
            failed_pipelines.append(error)
    
    # Fail the task if any pipelines failed
    if failed_pipelines:
        raise Exception(f"Pipeline monitor detected failures: {', '.join(failed_pipelines)}")
    
    print("All monitored pipelines are running correctly. Monitor completed successfully.")

# COMMAND ----------

# DBTITLE 1,Execute Monitor
monitor_experiment_pipelines()
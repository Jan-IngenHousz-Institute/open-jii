# Databricks notebook source
# DBTITLE 1,Ambyte Data Processing Task
# Standalone task to process raw ambyte trace files and write to parquet
# This task runs independently from the DLT pipeline and outputs processed parquet files

# COMMAND ----------

# DBTITLE 1,Install Dependencies
%pip install /Workspace/Shared/wheels/ambyte-0.2.0-py3-none-any.whl

# COMMAND ----------

# DBTITLE 1,Imports
import os
import pandas as pd
import numpy as np
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from dataclasses import dataclass
from pyspark.sql import SparkSession
from pyspark.dbutils import DBUtils

# Import the ambyte processing utilities
from ambyte import find_byte_folders, load_files_per_byte, process_trace_files, parse_upload_time

# Pipeline management imports
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.pipelines import StartUpdateResponse

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# COMMAND ----------

# DBTITLE 1,Configuration and Pipeline Management Classes

@dataclass(frozen=True)
class PipelineConfig:
    """Configuration for finding and triggering experiment pipelines."""
    experiment_id: str
    experiment_name: str
    environment: str = "DEV"
    
    @property
    def pipeline_name(self) -> str:
        """Standardized pipeline name matching the creation logic."""
        clean_name = self.experiment_name.lower().strip().replace(' ', '_')
        return f"exp-{clean_name}-DLT-Pipeline-{self.environment.upper()}"

class ExperimentPipelineManager:
    """Manages Delta Live Tables pipeline triggering for experiments."""
    
    def __init__(self, workspace_client: Optional[WorkspaceClient] = None):
        self.client = workspace_client or WorkspaceClient()
    
    def find_existing_pipeline(self, config: PipelineConfig) -> Optional[str]:
        """Find existing pipeline for the experiment."""
        try:
            pipelines = list(self.client.pipelines.list_pipelines())
            
            for pipeline in pipelines:
                if pipeline.name == config.pipeline_name:
                    logger.info(f"Found existing pipeline: {pipeline.pipeline_id}")
                    return pipeline.pipeline_id
                    
            logger.warning(f"No existing pipeline found for experiment {config.experiment_id}")
            return None
            
        except Exception as e:
            logger.error(f"Error searching for existing pipelines: {e}")
            raise
    
    def trigger_execution(self, pipeline_id: str, experiment_id: str) -> str:
        """Trigger pipeline execution."""
        try:
            logger.info(f"Triggering execution for pipeline {pipeline_id} (experiment {experiment_id})")
            
            response: StartUpdateResponse = self.client.pipelines.start_update(
                pipeline_id=pipeline_id
            )
            
            logger.info(f"Pipeline execution started with update ID: {response.update_id}")
            return response.update_id
            
        except Exception as e:
            logger.error(f"Failed to trigger pipeline execution: {e}")
            raise

# COMMAND ----------

# DBTITLE 1,Task Configuration
EXPERIMENT_ID = dbutils.widgets.get("EXPERIMENT_ID")
EXPERIMENT_NAME = dbutils.widgets.get("EXPERIMENT_NAME")
EXPERIMENT_SCHEMA = dbutils.widgets.get("EXPERIMENT_SCHEMA")
CATALOG_NAME = dbutils.widgets.get("CATALOG_NAME")
UPLOAD_DIRECTORY = dbutils.widgets.get("UPLOAD_DIRECTORY")
YEAR_PREFIX = dbutils.widgets.get("YEAR_PREFIX")
ENVIRONMENT = dbutils.widgets.get("ENVIRONMENT") if dbutils.widgets.get("ENVIRONMENT") else "DEV"

# Paths
AMBYTE_BASE_PATH = f"/Volumes/{CATALOG_NAME}/{EXPERIMENT_SCHEMA}/data-uploads/ambyte/{UPLOAD_DIRECTORY}"
PROCESSED_OUTPUT_PATH = f"/Volumes/{CATALOG_NAME}/{EXPERIMENT_SCHEMA}/data-uploads/processed-ambyte"

spark = SparkSession.builder.getOrCreate()
dbutils = DBUtils(spark)

logger.info(f"Processing ambyte data for experiment: {EXPERIMENT_ID}")
logger.info(f"Input path: {AMBYTE_BASE_PATH}")
logger.info(f"Output path: {PROCESSED_OUTPUT_PATH}")

# Pipeline configuration for triggering
pipeline_config = PipelineConfig(
    experiment_id=EXPERIMENT_ID,
    experiment_name=EXPERIMENT_NAME,
    environment=ENVIRONMENT
)

# COMMAND ----------

# DBTITLE 1,Process Ambyte Data
def process_and_save_ambyte_data():
    """
    Process raw ambyte trace files and save as a single parquet file.
    Combines data from all Ambyte folders and includes Ambyte information as columns.
    """
    # Process all ambyte data in the base path
    upload_dir = AMBYTE_BASE_PATH
    
    # Verify the ambyte directory exists
    try:
        dbutils.fs.ls(upload_dir)
    except Exception as e:
        raise Exception(f"Ambyte directory not found: {upload_dir}. Error: {e}")
    
    logger.info(f"\n{'='*80}")
    logger.info(f"Processing ambyte data directory")
    logger.info(f"Full path: {upload_dir}")
    logger.info(f"{'='*80}")
    
    processed_count = 0
    error_count = 0
    combined_dataframes = []
    
    # Find all Ambyte_N and unknown_ambyte folders within the ambyte directory
    try:
        byte_parent_folders = find_byte_folders(upload_dir)
        
        if byte_parent_folders:
            logger.info(f"Found {len(byte_parent_folders)} valid byte parent folders")
            logger.info(f"Folders: {[os.path.basename(x.rstrip('/')) for x in byte_parent_folders]}")
        else:
            logger.warning(f"No valid byte parent folders found in ambyte directory")
            raise Exception(f"No valid byte parent folders found in {upload_dir}")
            
    except Exception as e:
        logger.error(f"Error finding byte folders in ambyte directory: {e}")
        raise
    
    # Process each byte folder within the ambyte directory
    for ambyte_folder in byte_parent_folders:
        ambyte_folder_name = os.path.basename(ambyte_folder.rstrip('/'))
        
        try:
            # Load files from byte subfolders or unknown_ambit
            files_per_byte, _ = load_files_per_byte(ambyte_folder, year_prefix=YEAR_PREFIX)
            files_per_byte = [lst for lst in files_per_byte if lst]
            
            logger.info(f"\nProcessing {ambyte_folder_name}: {len(files_per_byte)} ambit(s)")
            
            # Process trace files
            df = process_trace_files(ambyte_folder_name, files_per_byte)
            
            if df is not None:
                # Reset index to make Time a regular column
                df = df.reset_index()
                
                # Add Ambyte folder information as a column
                df['ambyte_folder'] = ambyte_folder_name
                
                # Extract attributes and add as columns
                # The attrs dict contains metadata like 'Actinic' and 'Dark'
                if hasattr(df, 'attrs') and df.attrs:
                    logger.info(f"Found dataframe attributes: {df.attrs.keys()}")
                    for attr_key, attr_value in df.attrs.items():
                        col_name = f"meta_{attr_key}"
                        if col_name not in df.columns:
                            df[col_name] = attr_value
                            logger.info(f"Added attribute as column: {col_name} = {attr_value}")
                
                # Add processing timestamp
                df['processed_at'] = pd.Timestamp.now()
                
                # Ensure data types are Spark-compatible
                # Convert pandas nullable types to standard types for Spark
                for col in df.columns:
                    if hasattr(df[col].dtype, 'name'):
                        dtype_name = df[col].dtype.name
                        # Convert pandas nullable integer types to standard int32
                        if 'UInt16' in dtype_name:
                            df[col] = df[col].astype('Int32')
                        elif 'UInt8' in dtype_name:
                            df[col] = df[col].astype('Int32')
                        elif 'Int16' in dtype_name:
                            df[col] = df[col].astype('Int32')
                        # Convert pandas nullable float types to standard float32
                        elif 'Float32' in dtype_name:
                            df[col] = df[col].astype('float32')
                        # Convert categorical to string
                        elif df[col].dtype.name == 'category':
                            df[col] = df[col].astype(str)
                
                combined_dataframes.append(df)
                processed_count += 1
                
                logger.info(f"Processed {ambyte_folder_name}: {len(df):,} rows, {len(df.columns)} columns")
                
            else:
                logger.warning(f"No data returned from process_trace_files for {ambyte_folder_name}")
                error_count += 1
                
        except Exception as e:
            logger.error(f"Error processing {ambyte_folder_name}: {e}")
            import traceback
            traceback.print_exc()
            error_count += 1
    
    # Combine all dataframes if we have any
    if combined_dataframes:
        logger.info(f"\nCombining {len(combined_dataframes)} dataframes...")
        combined_df = pd.concat(combined_dataframes, ignore_index=True)
        
        # Generate filename with current timestamp
        current_time = datetime.now()
        timestamp = current_time.strftime("%Y%m%d_%H%M%S")
        object_name = f"ambyte_processed_{timestamp}"
        
        # Save combined data as a single parquet file
        output_path = f"{PROCESSED_OUTPUT_PATH}/{object_name}"
        
        # Ensure directory exists
        try:
            dbutils.fs.mkdirs(PROCESSED_OUTPUT_PATH)
        except Exception:
            pass  # Directory might already exist
        
        # Convert to Spark DataFrame and write as parquet
        spark_df = spark.createDataFrame(combined_df)
        spark_df.write.mode("overwrite").parquet(output_path)
        
        logger.info(f"Saved combined data: {output_path}")
        logger.info(f"  Total rows: {len(combined_df):,}")
        logger.info(f"  Total columns: {len(combined_df.columns)}")
        logger.info(f"  Ambyte folders included: {combined_df['ambyte_folder'].unique().tolist()}")
    
    # Summary
    logger.info(f"\n{'='*80}")
    logger.info(f"Processing Summary:")
    logger.info(f"  Processed: {processed_count} ambyte folder(s)")
    logger.info(f"  Errors: {error_count}")
    if combined_dataframes:
        logger.info(f"  Output file: ambyte_processed_{timestamp}.parquet")
    logger.info(f"{'='*80}")
    
    if error_count > 0 and processed_count == 0:
        raise Exception(f"All ambyte processing failed ({error_count} errors)")
    
    return processed_count, error_count, len(combined_dataframes) > 0

# COMMAND ----------

# DBTITLE 1,Pipeline Triggering Function
def trigger_experiment_pipeline(config: PipelineConfig) -> Optional[str]:
    """
    Trigger the experiment's Delta Live Tables pipeline after successful data processing.
    
    Args:
        config: Pipeline configuration
        
    Returns:
        Update ID if pipeline was triggered, None if no pipeline found
    """
    try:
        manager = ExperimentPipelineManager()
        
        # Find existing pipeline
        pipeline_id = manager.find_existing_pipeline(config)
        
        if pipeline_id:
            # Trigger pipeline execution
            update_id = manager.trigger_execution(pipeline_id, config.experiment_id)
            
            logger.info(f"\n{'='*80}")
            logger.info(f"Pipeline Triggered Successfully")
            logger.info(f"{'='*80}")
            logger.info(f"Pipeline Name: {config.pipeline_name}")
            logger.info(f"Pipeline ID: {pipeline_id}")
            logger.info(f"Update ID: {update_id}")
            logger.info(f"Experiment ID: {config.experiment_id}")
            logger.info(f"{'='*80}")
            
            return update_id
        else:
            logger.warning(f"\nWarning: No pipeline found with name '{config.pipeline_name}'")
            logger.warning(f"   The experiment pipeline may not have been created yet.")
            logger.warning(f"   Data processing completed but pipeline was not triggered.")
            return None
            
    except Exception as e:
        logger.error(f"\nError triggering pipeline: {e}")
        logger.error(f"Pipeline trigger failed: {e}")
        # Don't raise - data processing was successful, pipeline trigger is additional
        return None

# COMMAND ----------

# DBTITLE 1,Execute Processing and Pipeline Trigger
def main():
    """Main execution function with data processing and pipeline triggering."""
    try:
        # Process ambyte data
        processed, errors, data_saved = process_and_save_ambyte_data()
        
        pipeline_update_id = None
        
        # If data was successfully processed and saved, trigger the pipeline
        if data_saved and processed > 0:
            logger.info(f"\nTriggering experiment pipeline...")
            pipeline_update_id = trigger_experiment_pipeline(pipeline_config)
        
        # Return comprehensive status
        status = {
            "status": "success" if processed > 0 else "no_data",
            "processed_count": processed,
            "error_count": errors,
            "data_saved": data_saved,
            "pipeline_triggered": pipeline_update_id is not None,
            "pipeline_update_id": pipeline_update_id
        }
        
        return status
        
    except Exception as e:
        logger.error(f"Task execution failed: {e}")
        status = {
            "status": "error",
            "error_message": str(e),
            "processed_count": 0,
            "error_count": 1,
            "data_saved": False,
            "pipeline_triggered": False
        }
        return status

# Execute main function and exit with status
result = main()
logger.info(f"\n{'='*80}")
logger.info(f"Task Execution Complete")
logger.info(f"{'='*80}")
logger.info(f"Status: {result['status']}")
logger.info(f"Data Processing: {result['processed_count']} processed, {result['error_count']} errors")
logger.info(f"Data Saved: {result['data_saved']}")
logger.info(f"Pipeline Triggered: {result['pipeline_triggered']}")
if result.get('pipeline_update_id'):
    logger.info(f"Pipeline Update ID: {result['pipeline_update_id']}")
logger.info(f"{'='*80}")

dbutils.notebook.exit(result)

# Databricks notebook source
# DBTITLE 1,OpenJII Individual Experiment Pipeline Creator
"""
This notebook creates a cost-optimized Delta Live Tables pipeline for a specific experiment 
and triggers its initial execution with comprehensive error handling and monitoring.
"""
import re
import logging
from datetime import datetime
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.pipelines import (
    NotebookLibrary, 
    PipelineLibrary, 
    CreatePipelineResponse,
    StartUpdateResponse
)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# COMMAND ----------

# DBTITLE 1,Configuration and Data Classes

@dataclass(frozen=True)
class PipelineConfig:
    """Immutable configuration for pipeline creation."""
    experiment_id: str
    experiment_name: str
    catalog_name: str
    central_schema: str
    experiment_pipeline_path: str
    
    # todo
    @property
    def experiment_schema(self) -> str:
        """Derived schema name for the experiment."""
        clean_name = self._sanitize_name(self.experiment_name)
        return f"exp_{clean_name}"

    @property
    def pipeline_name(self) -> str:
        """Standardized pipeline name."""
        clean_name = self._sanitize_name(self.experiment_name)
        return f"exp_{clean_name}_pipeline_dev"

    def _sanitize_name(self, name: str) -> str:
        """Sanitize name for use in identifiers."""
        # Convert to lowercase, replace spaces and special chars with underscores
        clean = re.sub(r'[^\w\s-]', '', name.lower().strip())
        clean = re.sub(r'[-\s]+', '_', clean)
        # Remove multiple consecutive underscores
        clean = re.sub(r'_+', '_', clean)
        # Remove leading/trailing underscores
        return clean.strip('_')
    
    def validate(self) -> None:
        """Validate required configuration parameters."""
        required_fields = [
            (self.experiment_id, "experiment_id"),
            (self.experiment_name, "experiment_name"),
            (self.catalog_name, "catalog_name"),
            (self.central_schema, "central_schema"),
            (self.experiment_pipeline_path, "experiment_pipeline_path")
        ]
        
        missing_fields = [field_name for value, field_name in required_fields if not value]
        if missing_fields:
            raise ValueError(f"Missing required parameters: {', '.join(missing_fields)}")

@dataclass(frozen=True)
class PipelineCreationResult:
    """Result of pipeline creation operation."""
    pipeline_id: str
    update_id: Optional[str]
    was_existing: bool
    config: PipelineConfig

# COMMAND ----------

# DBTITLE 1,Parameter Extraction and Validation

def extract_parameters() -> PipelineConfig:
    """Extract and validate parameters from Databricks widgets."""
    try:
        config = PipelineConfig(
            experiment_id=dbutils.widgets.get("experiment_id"),
            experiment_name=dbutils.widgets.get("experiment_name"),
            catalog_name=dbutils.widgets.get("catalog_name"),
            central_schema=dbutils.widgets.get("central_schema"),
            experiment_pipeline_path=dbutils.widgets.get("experiment_pipeline_path")
        )
        
        config.validate()
        logger.info(f"Configuration validated for experiment: {config.experiment_id}")
        return config
        
    except Exception as e:
        logger.error(f"Parameter extraction failed: {e}")
        raise

# COMMAND ----------

# DBTITLE 1,Pipeline Management Class

class ExperimentPipelineManager:
    """Manages Delta Live Tables pipelines for experiments with cost optimization."""
    
    def __init__(self, workspace_client: Optional[WorkspaceClient] = None):
        self.client = workspace_client or WorkspaceClient()
    
    def find_existing_pipeline(self, config: PipelineConfig) -> Optional[str]:
        """
        Find existing pipeline for the experiment.
        
        Args:
            config: Pipeline configuration
            
        Returns:
            Pipeline ID if found, None otherwise
        """
        try:
            pipelines = list(self.client.pipelines.list_pipelines())
            
            for pipeline in pipelines:
                if pipeline.name == config.pipeline_name:
                    logger.info(f"Found existing pipeline: {pipeline.pipeline_id}")
                    return pipeline.pipeline_id
                    
            logger.info(f"No existing pipeline found for experiment {config.experiment_id}")
            return None
            
        except Exception as e:
            logger.error(f"Error searching for existing pipelines: {e}")
            raise
    
    def create_pipeline(self, config: PipelineConfig) -> str:
        """
        Create a new cost-optimized pipeline.
        
        Args:
            config: Pipeline configuration
            
        Returns:
            Created pipeline ID
        """
        logger.info(f"Creating cost-optimized pipeline: {config.pipeline_name}")
        
        try:
            notebook_library = NotebookLibrary(path=config.experiment_pipeline_path)
            library = PipelineLibrary(notebook=notebook_library)
            
            pipeline_configuration = {
                "EXPERIMENT_ID": config.experiment_id,
                "EXPERIMENT_NAME": config.experiment_name,
                "EXPERIMENT_SCHEMA": config.experiment_schema,
                "CENTRAL_SCHEMA": config.central_schema,
                "CENTRAL_SILVER_TABLE": "clean_data",
                "pipeline.name": config.pipeline_name
            }
            
            response: CreatePipelineResponse = self.client.pipelines.create(
                name=config.pipeline_name,
                target=config.experiment_schema,
                catalog=config.catalog_name,
                libraries=[library],
                configuration=pipeline_configuration,
                continuous=False,          # Cost optimization: manual triggering
                development=True,          # Cost optimization: development mode
                serverless=True,          # Cost optimization: serverless compute
                edition="ADVANCED",       # Required for serverless
                channel="CURRENT"
            )
            
            logger.info(f"Pipeline created successfully: {response.pipeline_id}")
            return response.pipeline_id
            
        except Exception as e:
            logger.error(f"Pipeline creation failed: {e}")
            raise
    
    def trigger_execution(self, pipeline_id: str, experiment_id: str) -> str:
        """
        Trigger pipeline execution.
        
        Args:
            pipeline_id: Target pipeline ID
            experiment_id: Experiment identifier for logging
            
        Returns:
            Update ID for the triggered execution
        """
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
    
    def get_pipeline_status(self, pipeline_id: str) -> Dict[str, Any]:
        """
        Retrieve current pipeline status and recent updates.
        
        Args:
            pipeline_id: Target pipeline ID
            
        Returns:
            Dictionary containing pipeline status information
        """
        try:
            pipeline_info = self.client.pipelines.get(pipeline_id=pipeline_id)
            
            status = {
                "pipeline_state": pipeline_info.state,
                "pipeline_id": pipeline_id,
                "latest_update": None
            }
            
            # Get latest update information
            updates_response = self.client.pipelines.list_updates(pipeline_id=pipeline_id)
            if updates_response.updates:
                latest_update = updates_response.updates[0]
                status["latest_update"] = {
                    "update_id": latest_update.update_id,
                    "state": latest_update.state,
                    "creation_time": latest_update.creation_time
                }
            
            return status
            
        except Exception as e:
            logger.error(f"Failed to retrieve pipeline status: {e}")
            raise

# COMMAND ----------

# DBTITLE 1,Pipeline Orchestration

def create_or_update_experiment_pipeline(config: PipelineConfig) -> PipelineCreationResult:
    """
    Main orchestration function to create or update experiment pipeline.
    
    Args:
        config: Validated pipeline configuration
        
    Returns:
        Pipeline creation result with metadata
    """
    manager = ExperimentPipelineManager()
    
    # Check for existing pipeline
    existing_pipeline_id = manager.find_existing_pipeline(config)
    
    if existing_pipeline_id:
        logger.info("Using existing pipeline and triggering execution")
        update_id = manager.trigger_execution(existing_pipeline_id, config.experiment_id)
        
        return PipelineCreationResult(
            pipeline_id=existing_pipeline_id,
            update_id=update_id,
            was_existing=True,
            config=config
        )
    else:
        logger.info("Creating new pipeline")
        pipeline_id = manager.create_pipeline(config)
        update_id = manager.trigger_execution(pipeline_id, config.experiment_id)
        
        return PipelineCreationResult(
            pipeline_id=pipeline_id,
            update_id=update_id,
            was_existing=False,
            config=config
        )

def print_execution_summary(result: PipelineCreationResult) -> None:
    """Print formatted execution summary."""
    status = "Updated" if result.was_existing else "Created"
    
    print(f"\n{'='*50}")
    print(f"Pipeline {status} Successfully")
    print(f"{'='*50}")
    print(f"Experiment ID: {result.config.experiment_id}")
    print(f"Experiment Name: {result.config.experiment_name}")
    print(f"Pipeline ID: {result.pipeline_id}")
    print(f"Update ID: {result.update_id}")
    print(f"Target Schema: {result.config.experiment_schema}")
    print(f"Pipeline Name: {result.config.pipeline_name}")
    print(f"{'='*50}\n")

# COMMAND ----------

# DBTITLE 1,Main Execution

def main() -> None:
    """Main execution function with comprehensive error handling."""
    try:
        # Extract and validate configuration
        config = extract_parameters()
        
        # Create or update pipeline
        result = create_or_update_experiment_pipeline(config)
        
        # Print summary
        print_execution_summary(result)
        
        # Optional: Check pipeline status
        manager = ExperimentPipelineManager()
        status = manager.get_pipeline_status(result.pipeline_id)
        
        print(f"\nCurrent Pipeline State: {status['pipeline_state']}")
        if status['latest_update']:
            print(f"Latest Update State: {status['latest_update']['state']}")
            
        logger.info("Pipeline operation completed successfully")
        
    except Exception as e:
        logger.error(f"Pipeline operation failed: {e}")
        print(f"\n❌ Error: {e}")
        raise

# Execute main function
if __name__ == "__main__":
    main()

# COMMAND ----------
# Databricks notebook source
# DBTITLE 1,openJII Individual Experiment Pipeline Creator
"""
This notebook creates a cost-optimized Delta Live Tables pipeline for a specific experiment 
and triggers its initial execution with comprehensive error handling and monitoring.
"""

import logging
import hashlib
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
    slack_channel: str
    environment: str = "DEV"
    experiment_number: Optional[int] = None  # Sequential experiment number
    
    def _generate_hash(self) -> str:
        """Generate a consistent 12-character hash from experiment_id."""
        # Use SHA256 and take first 12 characters for consistency
        hash_obj = hashlib.sha256(self.experiment_id.encode('utf-8'))
        return hash_obj.hexdigest()[:12]
    
    @property
    def experiment_schema(self) -> str:
        """
        Derived schema name for the experiment.
        Format: exp_{padded_number}_{12char_hash}
        Example: exp_00001_a1b2c3d4e5f6
        """
        hash_suffix = self._generate_hash()
        if self.experiment_number is not None:
            # Use provided experiment number, padded to 5 digits
            padded_num = str(self.experiment_number).zfill(5)
            return f"exp_{padded_num}_{hash_suffix}"
        else:
            # Fallback: use full hash (backwards compatibility)
            return f"exp_{hash_suffix}"
    
    @property
    def pipeline_name(self) -> str:
        """
        Standardized pipeline name.
        Format: Experiment-DLT-{ENV}-{padded_number}-{12char_hash}
        Example: Experiment-DLT-DEV-00001-a1b2c3d4e5f6
        """
        hash_suffix = self._generate_hash()
        if self.experiment_number is not None:
            padded_num = str(self.experiment_number).zfill(5)
            return f"Experiment-DLT-{self.environment.upper()}-{padded_num}-{hash_suffix}"
        else:
            # Fallback for experiments without numbers
            return f"Experiment-DLT-{self.environment.upper()}-{hash_suffix}"
    
    def validate(self) -> None:
        """Validate required configuration parameters."""
        required_fields = [
            (self.experiment_id, "experiment_id"),
            (self.experiment_name, "experiment_name"),
            (self.catalog_name, "catalog_name"),
            (self.central_schema, "central_schema"),
            (self.experiment_pipeline_path, "experiment_pipeline_path"),
            (self.slack_channel, "slack_channel")
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

# DBTITLE 1,Helper Functions
def get_next_experiment_number(catalog_name: str) -> int:
    """
    Determine the next experiment number by counting existing exp_ schemas.
    
    Args:
        catalog_name: Name of the catalog to check
        
    Returns:
        Next sequential experiment number (1-based)
    """
    try:
        # Query to count existing experiment schemas
        # Schemas follow the pattern: exp_NNNNN_* or exp_*
        schemas_df = spark.sql(f"SHOW SCHEMAS IN {catalog_name}")
        
        # Count schemas that start with 'exp_'
        exp_schemas = [
            row.databaseName for row in schemas_df.collect() 
            if row.databaseName.startswith('exp_')
        ]
        
        # The next number is the count + 1
        next_number = len(exp_schemas) + 1
        
        logger.info(f"Found {len(exp_schemas)} existing experiment schemas")
        logger.info(f"Next experiment number: {next_number}")
        
        return next_number
        
    except Exception as e:
        logger.error(f"Failed to determine experiment number: {e}")
        logger.warning("Falling back to None (will use hash-only format)")
        return None

# COMMAND ----------

# DBTITLE 1,Parameter Extraction and Validation
def extract_parameters() -> PipelineConfig:
    """Extract and validate parameters from Databricks widgets."""
    try:
        catalog_name = dbutils.widgets.get("catalog_name")
        
        # Auto-determine experiment number by counting existing schemas
        experiment_number = get_next_experiment_number(catalog_name)
        
        config = PipelineConfig(
            experiment_id=dbutils.widgets.get("experiment_id"),
            experiment_name=dbutils.widgets.get("experiment_name"),
            catalog_name=catalog_name,
            central_schema=dbutils.widgets.get("central_schema"),
            experiment_pipeline_path=dbutils.widgets.get("experiment_pipeline_path"),
            slack_channel=dbutils.widgets.get("slack_channel"),
            environment=dbutils.widgets.get("environment") if dbutils.widgets.get("environment") else "DEV",
            experiment_number=experiment_number
        )
        
        config.validate()
        logger.info(f"Configuration validated for experiment: {config.experiment_id}")
        logger.info(f"Experiment number: {experiment_number}")
        logger.info(f"Schema name: {config.experiment_schema}")
        logger.info(f"Pipeline name: {config.pipeline_name}")
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
                "CATALOG_NAME": config.catalog_name,
                "CENTRAL_SCHEMA": config.central_schema,
                "CENTRAL_SILVER_TABLE": "clean_data",
                "ENVIRONMENT": config.environment,
                "MONITORING_SLACK_CHANNEL": config.slack_channel,
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
    print(f"Scheduling: Managed by unified scheduler (runs every 15min, 9am-9pm UTC)")
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
        
        # Set task values for downstream tasks to access
        dbutils.jobs.taskValues.set(key="pipeline_id", value=result.pipeline_id)
        dbutils.jobs.taskValues.set(key="schema_name", value=result.config.experiment_schema)
        dbutils.jobs.taskValues.set(key="pipeline_name", value=result.config.pipeline_name)
        dbutils.jobs.taskValues.set(key="was_existing", value=str(result.was_existing))
        
        logger.info(f"Task values set: pipeline_id={result.pipeline_id}, schema_name={result.config.experiment_schema}")
        
    except Exception as e:
        logger.error(f"Pipeline operation failed: {e}")
        print(f"\n❌ Error: {e}")
        raise

# Execute main function
if __name__ == "__main__":
    main()

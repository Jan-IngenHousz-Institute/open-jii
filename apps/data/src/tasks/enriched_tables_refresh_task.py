# Databricks notebook source
# DBTITLE 1,Enriched Tables Refresh Task
"""
This notebook performs a full refresh of enriched tables across multiple experiment pipelines
when metadata changes (e.g., user profile update, location data change).

It finds all experiments for a given metadata key, locates their pipelines, and triggers
a full refresh of only the enriched tables that contain the metadata.
"""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Set
from concurrent.futures import ThreadPoolExecutor, as_completed
import re

from databricks.sdk import WorkspaceClient
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# COMMAND ----------

# DBTITLE 1,Configuration

def extract_parameters() -> Dict[str, str]:
    """Extract parameters from Databricks widgets."""
    try:
        params = {
            "metadata_key": dbutils.widgets.get("metadata_key"),  # e.g., "user_id", "location_id"
            "metadata_value": dbutils.widgets.get("metadata_value"),  # e.g., "user123", "location456"
            "catalog_name": dbutils.widgets.get("catalog_name"),
            "central_schema": dbutils.widgets.get("central_schema"),
            "central_silver_table": dbutils.widgets.get("central_silver_table"),
            "environment": dbutils.widgets.get("environment") if dbutils.widgets.get("environment") else "DEV"
        }
        
        logger.info(f"Configuration extracted: {params}")
        return params
        
    except Exception as e:
        logger.error(f"Parameter extraction failed: {e}")
        raise

# COMMAND ----------

# DBTITLE 1,Enriched Tables Refresh Orchestrator
class EnrichedTablesRefreshOrchestrator:
    """Orchestrates full refresh of enriched tables across experiments for specific metadata changes."""
    
    def __init__(self, workspace_client: Optional[WorkspaceClient] = None, environment: str = "DEV"):
        self.client = workspace_client or WorkspaceClient()
        self.spark = SparkSession.builder.getOrCreate()
        self.environment = environment.upper()
        self.pipeline_suffix = f"-DLT-Pipeline-{self.environment}"
    
    def get_experiments_for_metadata(self, catalog_name: str, schema_name: str, table_name: str, 
                                    metadata_key: str, metadata_value: str) -> Set[str]:
        """
        Query the central silver table to get all experiment IDs for specific metadata.
        
        Args:
            catalog_name: Catalog containing the central silver table
            schema_name: Schema containing the central silver table  
            table_name: Name of the central silver table
            metadata_key: Column name to filter on (e.g., "user_id", "location_id")
            metadata_value: Value to search for
            
        Returns:
            Set of experiment IDs associated with this metadata
        """
        try:
            logger.info(f"Querying experiments for {metadata_key}={metadata_value} from {catalog_name}.{schema_name}.{table_name}")
            
            # Validate identifiers
            identifier_pattern = re.compile(r'^[a-zA-Z0-9_-]+$')
            for name, value in [("catalog_name", catalog_name), ("schema_name", schema_name), 
                              ("table_name", table_name), ("metadata_key", metadata_key)]:
                if not identifier_pattern.match(value):
                    raise ValueError(f"Invalid identifier for {name}: {value}")
            
            # Full table path with catalog and schema
            full_table_path = f"{catalog_name}.{schema_name}.{table_name}"
            
            # Query central silver table for experiments with this metadata
            experiments_df = self.spark.sql(f"""
                SELECT DISTINCT experiment_id 
                FROM {full_table_path}
                WHERE {metadata_key} = '{metadata_value}' 
                  AND experiment_id IS NOT NULL
            """)
            
            # Convert to set of experiment IDs
            experiment_ids = set(row.experiment_id for row in experiments_df.collect())
            
            logger.info(f"Found {len(experiment_ids)} experiments for {metadata_key}={metadata_value}: {', '.join(sorted(experiment_ids))}")
            return experiment_ids
            
        except Exception as e:
            logger.error(f"Error querying experiments for metadata: {e}")
            raise

    
    def find_experiment_pipelines_for_experiments(self, experiment_ids: Set[str]) -> List[Dict[str, str]]:
        """
        Find experiment pipelines for the given experiment IDs.
        
        Args:
            experiment_ids: Set of experiment IDs to find pipelines for
            
        Returns:
            List of dictionaries containing pipeline info
        """
        try:
            logger.info(f"Searching for experiment pipelines for {len(experiment_ids)} experiments...")
            
            pipelines = list(self.client.pipelines.list_pipelines())
            matching_pipelines = []
            
            for pipeline in pipelines:
                # Filter for experiment pipelines
                if pipeline.name and pipeline.name.startswith('exp-') and pipeline.name.endswith(self.pipeline_suffix):
                    # Get pipeline configuration to extract experiment_id
                    pipeline_id = pipeline.pipeline_id
                    try:
                        pipeline_details = self.client.pipelines.get(pipeline_id)
                        config = self._get_pipeline_config(pipeline_details)
                        
                        if config:
                            experiment_id = config.get("EXPERIMENT_ID")
                            if experiment_id in experiment_ids:
                                matching_pipelines.append({
                                    'pipeline_id': pipeline_id,
                                    'name': pipeline.name,
                                    'experiment_id': experiment_id,
                                    'state': pipeline.state.value if pipeline.state else 'UNKNOWN'
                                })
                    except Exception as config_error:
                        logger.warning(f"Could not extract config for pipeline {pipeline.name}: {config_error}")
            
            logger.info(f"Found {len(matching_pipelines)} matching experiment pipelines")
            for pipeline in matching_pipelines:
                logger.info(f"  - {pipeline['name']} (ID: {pipeline['pipeline_id']}, Experiment ID: {pipeline['experiment_id']}, State: {pipeline['state']})")
                
            return matching_pipelines
            
        except Exception as e:
            logger.error(f"Error finding experiment pipelines: {e}")
            raise
    
    def _get_pipeline_config(self, pipeline_details) -> Optional[Dict[str, Any]]:
        """
        Extract configuration from pipeline details.
        """
        try:
            spec = getattr(pipeline_details, "spec", None)
            if spec is None and isinstance(pipeline_details, dict):
                spec = pipeline_details.get("spec")
            
            if not spec:
                return None
                
            config = None
            if isinstance(spec, dict):
                config = spec.get("configuration")
            else:
                config = getattr(spec, "configuration", None)
                
            return config if isinstance(config, dict) else None
        except Exception as e:
            logger.warning(f"Error extracting pipeline configuration: {e}")
            return None
    
    def get_enriched_tables_for_pipeline(self, pipeline_id: str) -> List[str]:
        """
        Get the list of enriched table names for a given pipeline.
        These are the silver quality tables that contain metadata and need to be refreshed.
        
        Args:
            pipeline_id: Pipeline ID to inspect
            
        Returns:
            List of enriched table names (tables with quality="silver")
        """
        try:
            pipeline_details = self.client.pipelines.get(pipeline_id)
            config = self._get_pipeline_config(pipeline_details)
            
            if not config:
                logger.error(f"No configuration found for pipeline {pipeline_id}")
                return []
            
            target = config.get("EXPERIMENT_SCHEMA")
            catalog = config.get("CATALOG_NAME")
            
            if not target or not catalog:
                logger.error(f"Missing EXPERIMENT_SCHEMA or CATALOG_NAME for pipeline {pipeline_id}")
                return []
            
            # Use DESCRIBE DETAIL to get table properties and filter for silver quality
            logger.info(f"Finding silver quality tables in {catalog}.{target}")
            
            # First get all tables in the schema
            all_tables_df = self.spark.sql(f"""
                SELECT table_name 
                FROM {catalog}.information_schema.tables 
                WHERE table_schema = '{target}'
            """)
            
            enriched_tables = []
            
            # Check each table's properties to find silver quality tables
            for row in all_tables_df.collect():
                table_name = row.table_name
                try:
                    # Check if table has quality=silver property
                    quality_df = self.spark.sql(f"""
                        SELECT get_json_object(properties, '$.quality') as quality
                        FROM (DESCRIBE DETAIL {catalog}.{target}.{table_name})
                        WHERE properties IS NOT NULL
                    """)
                    
                    quality_rows = quality_df.collect()
                    if quality_rows and quality_rows[0]["quality"] == "silver":
                        enriched_tables.append(table_name)
                        logger.debug(f"Found silver quality table: {table_name}")
                        
                except Exception as table_error:
                    logger.warning(f"Could not check properties for table {table_name}: {table_error}")
            
            logger.info(f"Found enriched tables for pipeline {pipeline_id}: {enriched_tables}")
            return enriched_tables
            
        except Exception as e:
            logger.error(f"Error getting enriched tables for pipeline {pipeline_id}: {e}")
            return []
    
    def refresh_enriched_tables_in_pipeline(self, pipeline_info: Dict[str, str]) -> Dict[str, Any]:
        """
        Perform a full refresh of enriched tables in a single pipeline.
        
        Args:
            pipeline_info: Dictionary containing pipeline information
            
        Returns:
            Result dictionary with execution details
        """
        pipeline_id = pipeline_info['pipeline_id']
        pipeline_name = pipeline_info['name']
        experiment_id = pipeline_info['experiment_id']
        
        try:
            logger.info(f"Refreshing enriched tables in pipeline: {pipeline_name}")
            
            # Get the enriched tables for this pipeline
            enriched_tables = self.get_enriched_tables_for_pipeline(pipeline_id)
            
            if not enriched_tables:
                logger.info(f"No enriched tables found for pipeline {pipeline_name} - skipping")
                return {
                    'pipeline_id': pipeline_id,
                    'pipeline_name': pipeline_name,
                    'experiment_id': experiment_id,
                    'status': 'SKIPPED',
                    'reason': 'No enriched tables found',
                    'timestamp': datetime.now().isoformat()
                }
            
            logger.info(f"Starting full refresh of {len(enriched_tables)} enriched tables: {', '.join(enriched_tables)}")
            
            # Start update with full refresh and table selection
            response = self.client.pipelines.start_update(
                pipeline_id=pipeline_id,
                full_refresh_selection=enriched_tables
            )
            
            result = {
                'pipeline_id': pipeline_id,
                'pipeline_name': pipeline_name,
                'experiment_id': experiment_id,
                'update_id': response.update_id,
                'enriched_tables': enriched_tables,
                'status': 'REFRESHING',
                'timestamp': datetime.now().isoformat()
            }
            
            logger.info(f"Successfully started refresh for {pipeline_name} with update ID: {response.update_id}")
            logger.info(f"  Refreshing tables: {', '.join(enriched_tables)}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to refresh enriched tables in pipeline {pipeline_name}: {e}")
            return {
                'pipeline_id': pipeline_id,
                'pipeline_name': pipeline_name,
                'experiment_id': experiment_id,
                'update_id': None,
                'status': 'FAILED',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def refresh_all_enriched_tables_parallel(self, experiment_pipelines: List[Dict[str, str]], max_workers: int = 3) -> List[Dict[str, Any]]:
        """
        Refresh enriched tables in all experiment pipelines in parallel.
        
        Args:
            experiment_pipelines: List of experiment pipeline information
            max_workers: Maximum number of parallel executions
            
        Returns:
            List of execution results
        """
        logger.info(f"Starting parallel refresh of enriched tables (max_workers={max_workers})...")
        results = []
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all pipeline refresh operations
            future_to_pipeline = {
                executor.submit(self.refresh_enriched_tables_in_pipeline, pipeline_info): pipeline_info
                for pipeline_info in experiment_pipelines
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_pipeline):
                result = future.result()
                results.append(result)
        
        return results

# COMMAND ----------

# DBTITLE 1,Execution and Reporting
def print_refresh_summary(results: List[Dict[str, Any]], metadata_key: str, metadata_value: str) -> None:
    """Print formatted refresh execution summary."""
    successful = [r for r in results if r['status'] == 'REFRESHING']
    failed = [r for r in results if r['status'] == 'FAILED']
    skipped = [r for r in results if r['status'] == 'SKIPPED']
    
    print(f"\n{'='*60}")
    print(f"Enriched Tables Refresh Summary")
    print(f"{'='*60}")
    print(f"{metadata_key}: {metadata_value}")
    print(f"Total Pipelines: {len(results)}")
    print(f"Successfully Started Refresh: {len(successful)}")
    print(f"Failed: {len(failed)}")
    print(f"Skipped: {len(skipped)}")
    print(f"Execution Time: {datetime.now().isoformat()}")
    print(f"{'='*60}")
    
    if successful:
        print(f"\nSuccessfully Started Refresh ({len(successful)}):")
        for result in successful:
            tables_info = f" (Tables: {', '.join(result.get('enriched_tables', []))})"
            print(f"  - {result['pipeline_name']} (Update ID: {result['update_id']}){tables_info}")
    
    if skipped:
        print(f"\nSkipped ({len(skipped)}):")
        for result in skipped:
            reason = result.get('reason', 'Unknown reason')
            print(f"  - {result['pipeline_name']}: {reason}")
    
    if failed:
        print(f"\nFailed ({len(failed)}):")
        for result in failed:
            print(f"  - {result['pipeline_name']}: {result.get('error', 'Unknown error')}")
    
    print(f"\n{'='*60}\n")

def main() -> None:
    """Main execution function."""
    try:
        # Extract configuration
        params = extract_parameters()
        metadata_key = params["metadata_key"]
        metadata_value = params["metadata_value"]
        
        # Initialize orchestrator
        orchestrator = EnrichedTablesRefreshOrchestrator(environment=params["environment"])
        
        # Get all experiment IDs for this metadata from the central silver table
        experiment_ids = orchestrator.get_experiments_for_metadata(
            catalog_name=params["catalog_name"],
            schema_name=params["central_schema"],
            table_name=params["central_silver_table"],
            metadata_key=metadata_key,
            metadata_value=metadata_value
        )
        
        if not experiment_ids:
            logger.info(f"No experiments found for {metadata_key}={metadata_value}. Nothing to refresh.")
            print(f"\n📝 No experiments found for {metadata_key}={metadata_value}.")
            return
        
        logger.info(f"{metadata_key}={metadata_value} has data in {len(experiment_ids)} experiments: {', '.join(sorted(experiment_ids))}")
        
        # Find experiment pipelines for these experiments
        experiment_pipelines = orchestrator.find_experiment_pipelines_for_experiments(experiment_ids)
        
        if not experiment_pipelines:
            logger.info(f"No experiment pipelines found for {metadata_key}={metadata_value} experiments. Nothing to refresh.")
            print(f"\n📝 No experiment pipelines found for {metadata_key}={metadata_value} experiments.")
            return
        
        logger.info(f"Found {len(experiment_pipelines)} experiment pipelines to refresh")
        print(f"\n📝 Found {len(experiment_pipelines)} experiment pipelines to refresh:")
        for pipeline in experiment_pipelines:
            print(f"  - {pipeline['name']} (Experiment ID: {pipeline['experiment_id']})")
        
        # Refresh enriched tables in all pipelines
        # Use parallel execution but limit concurrency to avoid overwhelming Databricks
        results = orchestrator.refresh_all_enriched_tables_parallel(
            experiment_pipelines, 
            max_workers=3  # Conservative to avoid overwhelming Databricks
        )
        
        # Print summary
        print_refresh_summary(results, metadata_key, metadata_value)
        
        # Log final status
        successful_count = len([r for r in results if r['status'] == 'REFRESHING'])
        logger.info(f"Enriched tables refresh completed for {metadata_key}={metadata_value}: {successful_count}/{len(experiment_pipelines)} successful")
        
    except Exception as e:
        logger.error(f"Enriched tables refresh failed: {e}")
        print(f"\nRefresh Error: {e}")
        raise

# Execute main function
if __name__ == "__main__":
    main()
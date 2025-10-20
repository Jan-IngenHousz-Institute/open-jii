# Databricks notebook source
# DBTITLE 1,Experiment Pipelines Orchestrator
"""
This notebook finds all experiment pipelines and triggers their execution in batch.
It's designed to run after the central pipeline completes to ensure fresh data is available.
"""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Set
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import re

from databricks.sdk import WorkspaceClient
from pyspark.sql import SparkSession

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# COMMAND ----------

# DBTITLE 1,Configuration

def extract_parameters() -> Dict[str, str]:
    """Extract parameters from Databricks widgets."""
    try:
        params = {
            "catalog_name": dbutils.widgets.get("catalog_name"),
            "schema_name": dbutils.widgets.get("central_schema"),
            "experiment_status_table": dbutils.widgets.get("experiment_status_table")
        }
        
        logger.info(f"Configuration extracted: {params}")
        return params
        
    except Exception as e:
        logger.error(f"Parameter extraction failed: {e}")
        raise

# COMMAND ----------

# DBTITLE 1,Experiment Pipeline Orchestrator

class ExperimentPipelineOrchestrator:
    """Orchestrates execution of all experiment pipelines."""
    
    def __init__(self, workspace_client: Optional[WorkspaceClient] = None):
        self.client = workspace_client or WorkspaceClient()
        self.spark = SparkSession.builder.getOrCreate()
    
    def get_fresh_experiment_ids(self, catalog_name: str, schema_name: str, status_table_name: str) -> Set[str]:
        """
        Query the experiment_status table to get experiment IDs with 'fresh' status.
        
        Args:
            catalog_name: Catalog containing the experiment_status table
            schema_name: Schema containing the experiment_status table
            status_table_name: Name of the experiment status table
            
        Returns:
            Set of experiment IDs with 'fresh' status
        """
        try:
            logger.info(f"Querying fresh experiments from {catalog_name}.{schema_name}.{status_table_name}")
            
            # Full table path with catalog and schema
            full_table_path = f"{catalog_name}.{schema_name}.{status_table_name}"
            
            # Query experiment status table for fresh experiments
            fresh_experiments_df = self.spark.sql(f"""
                SELECT experiment_id 
                FROM {full_table_path}
                WHERE status = 'fresh'
            """)
            
            # Convert to list of experiment IDs
            fresh_experiment_ids = set(row.experiment_id for row in fresh_experiments_df.collect())
            
            logger.info(f"Found {len(fresh_experiment_ids)} fresh experiments")
            return fresh_experiment_ids
            
        except Exception as e:
            logger.error(f"Error querying experiment status table: {e}")
            raise
    
    def find_experiment_pipelines(self) -> List[Dict[str, str]]:
        """
        Find all experiment pipelines (pipelines with names starting with 'exp-').
        Extracts experiment_id from pipeline configuration parameters.
        
        Returns:
            List of dictionaries containing pipeline info
        """
        try:
            logger.info("Searching for experiment pipelines...")
            
            pipelines = list(self.client.pipelines.list_pipelines())
            experiment_pipelines = []
            
            for pipeline in pipelines:
                # Filter for experiment pipelines
                if pipeline.name and pipeline.name.startswith('exp-') and pipeline.name.endswith('-DLT-Pipeline-DEV'):
                    # Get pipeline configuration to extract experiment_id
                    pipeline_id = pipeline.pipeline_id
                    try:
                        # Get full pipeline details including configuration
                        pipeline_details = self.client.pipelines.get(pipeline_id)
                        experiment_id = self._extract_experiment_id_from_config(pipeline_details)
                        
                        experiment_pipelines.append({
                            'pipeline_id': pipeline_id,
                            'name': pipeline.name,
                            'experiment_id': experiment_id,
                            'state': pipeline.state.value if pipeline.state else 'UNKNOWN'
                        })
                    except Exception as config_error:
                        logger.warning(f"Could not extract experiment_id from config for pipeline {pipeline.name}: {config_error}")
                        experiment_pipelines.append({
                            'pipeline_id': pipeline_id,
                            'name': pipeline.name,
                            'experiment_id': None,
                            'state': pipeline.state.value if pipeline.state else 'UNKNOWN'
                        })
            
            logger.info(f"Found {len(experiment_pipelines)} experiment pipelines")
            for pipeline in experiment_pipelines:
                logger.info(f"  - {pipeline['name']} (ID: {pipeline['pipeline_id']}, Experiment ID: {pipeline['experiment_id']}, State: {pipeline['state']})")
                
            return experiment_pipelines
            
        except Exception as e:
            logger.error(f"Error finding experiment pipelines: {e}")
            raise
    
    def _extract_experiment_id_from_config(self, pipeline_details) -> Optional[str]:
        """
        Extract experiment_id from pipeline configuration.
        """
        try:
            config = getattr(pipeline_details, "configuration", None)
            if config and isinstance(config, dict):
                return config.get("EXPERIMENT_ID")
            logger.debug("Could not find EXPERIMENT_ID in pipeline configuration")
            return None
        except Exception as e:
            logger.warning(f"Error extracting experiment_id from pipeline configuration: {e}")
            return None
    

    
    def trigger_pipeline(self, pipeline_info: Dict[str, str]) -> Dict[str, Any]:
        """
        Trigger a single pipeline execution.
        
        Args:
            pipeline_info: Dictionary containing pipeline information
            
        Returns:
            Result dictionary with execution details
        """
        pipeline_id = pipeline_info['pipeline_id']
        pipeline_name = pipeline_info['name']
        
        try:
            logger.info(f"Triggering pipeline: {pipeline_name}")
            
            response = self.client.pipelines.start_update(pipeline_id=pipeline_id)
            
            result = {
                'pipeline_id': pipeline_id,
                'pipeline_name': pipeline_name,
                'update_id': response.update_id,
                'status': 'TRIGGERED',
                'timestamp': datetime.now().isoformat()
            }
            
            logger.info(f"Successfully triggered {pipeline_name} with update ID: {response.update_id}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to trigger pipeline {pipeline_name}: {e}")
            return {
                'pipeline_id': pipeline_id,
                'pipeline_name': pipeline_name,
                'update_id': None,
                'status': 'FAILED',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def trigger_all_experiments_sequential(self, experiment_pipelines: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """
        Trigger all experiment pipelines sequentially.
        
        Args:
            experiment_pipelines: List of experiment pipeline information
            
        Returns:
            List of execution results
        """
        logger.info("Starting sequential execution of experiment pipelines...")
        results = []
        
        for pipeline_info in experiment_pipelines:
            result = self.trigger_pipeline(pipeline_info)
            results.append(result)
            
            # Small delay between triggers to avoid overwhelming the system
            time.sleep(2)
        
        return results
    
    def trigger_all_experiments_parallel(self, experiment_pipelines: List[Dict[str, str]], max_workers: int = 5) -> List[Dict[str, Any]]:
        """
        Trigger all experiment pipelines in parallel.
        
        Args:
            experiment_pipelines: List of experiment pipeline information
            max_workers: Maximum number of parallel executions
            
        Returns:
            List of execution results
        """
        logger.info(f"Starting parallel execution of experiment pipelines (max_workers={max_workers})...")
        results = []
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all pipeline triggers
            future_to_pipeline = {
                executor.submit(self.trigger_pipeline, pipeline_info): pipeline_info
                for pipeline_info in experiment_pipelines
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_pipeline):
                result = future.result()
                results.append(result)
        
        return results

# COMMAND ----------

# DBTITLE 1,Execution and Reporting

def print_execution_summary(results: List[Dict[str, Any]]) -> None:
    """Print formatted execution summary."""
    successful = [r for r in results if r['status'] == 'TRIGGERED']
    failed = [r for r in results if r['status'] == 'FAILED']
    
    print(f"\n{'='*60}")
    print(f"Experiment Pipelines Execution Summary")
    print(f"{'='*60}")
    print(f"Total Pipelines: {len(results)}")
    print(f"Successfully Triggered: {len(successful)}")
    print(f"Failed: {len(failed)}")
    print(f"Execution Time: {datetime.now().isoformat()}")
    print(f"{'='*60}")
    
    if successful:
        print(f"\nSuccessfully Triggered ({len(successful)}):")
        for result in successful:
            print(f"  - {result['pipeline_name']} (Update ID: {result['update_id']})")
    
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
        
        # Initialize orchestrator
        orchestrator = ExperimentPipelineOrchestrator()
        
        # Get fresh experiment IDs from the experiment_status table
        fresh_experiment_ids = orchestrator.get_fresh_experiment_ids(
            catalog_name=params["catalog_name"],
            schema_name=params["schema_name"],
            status_table_name=params["experiment_status_table"]
        )
        
        if not fresh_experiment_ids:
            logger.info("No fresh experiments found. Nothing to execute.")
            print("\n📝 No fresh experiments found in the experiment_status table.")
            return
        
        # Log the fresh experiment IDs for debugging
        logger.info(f"Fresh experiment IDs: {', '.join(sorted(fresh_experiment_ids))}")
        
        # Find all experiment pipelines
        all_experiment_pipelines = orchestrator.find_experiment_pipelines()
        
        if not all_experiment_pipelines:
            logger.info("No experiment pipelines found. Nothing to execute.")
            print("\n📝 No experiment pipelines found.")
            return
        
        # Debug: Print all extracted experiment IDs and their sources
        pipeline_experiment_ids = {p.get('experiment_id', 'NONE'): p['name'] for p in all_experiment_pipelines}
        logger.info(f"Found {len(pipeline_experiment_ids)} pipeline experiment IDs:")
        for exp_id, name in pipeline_experiment_ids.items():
            logger.info(f"  - Pipeline: {name} → Experiment ID: {exp_id or 'None'}")
        
        # Filter pipelines to only include those with fresh experiment data
        fresh_pipelines = [
            pipeline for pipeline in all_experiment_pipelines 
            if pipeline.get('experiment_id') in fresh_experiment_ids
        ]
        
        # Debug: Log intersection between fresh experiment IDs and pipeline experiment IDs
        matches = fresh_experiment_ids.intersection(
            {p.get('experiment_id') for p in all_experiment_pipelines if p.get('experiment_id')}
        )
        logger.info(f"Matches between fresh experiments and pipelines: {len(matches)}")
        for match in sorted(matches):
            matching_pipelines = [p['name'] for p in all_experiment_pipelines 
                                if p.get('experiment_id') == match]
            logger.info(f"  - Experiment ID: {match} → Pipelines: {', '.join(matching_pipelines)}")
        
        if not fresh_pipelines:
            logger.info("No pipelines with fresh experiment data found. Nothing to execute.")
            print("\n📝 No pipelines with fresh experiment data found.")
            return
        
        logger.info(f"Found {len(fresh_pipelines)} pipelines with fresh experiment data out of {len(all_experiment_pipelines)} total pipelines")
        print(f"\n📝 Found {len(fresh_pipelines)} pipelines with fresh experiment data:")
        for pipeline in fresh_pipelines:
            print(f"  - {pipeline['name']} (Experiment ID: {pipeline['experiment_id']})")
        
        # Trigger only pipelines with fresh experiment data
        # Use parallel execution for better performance, but limit concurrency
        results = orchestrator.trigger_all_experiments_parallel(
            fresh_pipelines, 
            max_workers=3  # Conservative to avoid overwhelming Databricks
        )
        
        # Print summary
        print_execution_summary(results)
        
        # Log final status
        successful_count = len([r for r in results if r['status'] == 'TRIGGERED'])
        logger.info(f"Experiment pipeline orchestration completed: {successful_count}/{len(fresh_pipelines)} successful")
        
    except Exception as e:
        logger.error(f"Experiment pipeline orchestration failed: {e}")
        print(f"\nOrchestration Error: {e}")
        raise

# Execute main function
if __name__ == "__main__":
    main()
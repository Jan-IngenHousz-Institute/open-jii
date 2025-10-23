# Databricks notebook source
# DBTITLE 1,Experiment Pipelines Orchestrator
"""
This notebook finds all experiment pipelines and triggers their execution in batch.
It's designed to run after the central pipeline completes to ensure fresh data is available.
"""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.pipelines import PipelineStateInfo

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# COMMAND ----------

# DBTITLE 1,Configuration

def extract_parameters() -> Dict[str, str]:
    """Extract parameters from Databricks widgets."""
    try:
        params = {
            "catalog_name": dbutils.widgets.get("catalog_name")
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
    
    def find_experiment_pipelines(self) -> List[Dict[str, str]]:
        """
        Find all experiment pipelines (pipelines with names starting with 'exp-').
        
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
                    experiment_pipelines.append({
                        'pipeline_id': pipeline.pipeline_id,
                        'name': pipeline.name,
                        'state': pipeline.state.value if pipeline.state else 'UNKNOWN'
                    })
            
            logger.info(f"Found {len(experiment_pipelines)} experiment pipelines")
            for pipeline in experiment_pipelines:
                logger.info(f"  - {pipeline['name']} (ID: {pipeline['pipeline_id']}, State: {pipeline['state']})")
                
            return experiment_pipelines
            
        except Exception as e:
            logger.error(f"Error finding experiment pipelines: {e}")
            raise
    
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
        
        # Find all experiment pipelines
        experiment_pipelines = orchestrator.find_experiment_pipelines()
        
        if not experiment_pipelines:
            logger.info("No experiment pipelines found. Nothing to execute.")
            print("\n📝 No experiment pipelines found.")
            return
        
        # Trigger all experiment pipelines
        # Use parallel execution for better performance, but limit concurrency
        results = orchestrator.trigger_all_experiments_parallel(
            experiment_pipelines, 
            max_workers=3  # Conservative to avoid overwhelming Databricks
        )
        
        # Print summary
        print_execution_summary(results)
        
        # Log final status
        successful_count = len([r for r in results if r['status'] == 'TRIGGERED'])
        logger.info(f"Experiment pipeline orchestration completed: {successful_count}/{len(results)} successful")
        
    except Exception as e:
        logger.error(f"Experiment pipeline orchestration failed: {e}")
        print(f"\nOrchestration Error: {e}")
        raise

# Execute main function
if __name__ == "__main__":
    main()
# Databricks notebook source
# DBTITLE 1,OpenJII Experiment Status Update Task
"""
This notebook sends experiment provisioning status updates to the OpenJII backend webhook.
It should be executed after the experiment pipeline creation task in a shared job.

Workflow:
1. The experiment_pipeline_create_task.py creates a pipeline for an experiment
2. If the creation is successful, this task is executed and reports SUCCESS to the webhook
3. If the creation fails, this task is executed in a failure context and reports FAILED to the webhook
4. The backend processes these statuses to update the experiment status accordingly:
   - SUCCESS → active
   - FAILED → provisioning_failed
   - CANCELED → provisioning_canceled

Configuration (all provided via Spark config at infrastructure-as-code level):
- webhook_url: MUST be provided via Spark configuration as 'spark.env.webhookUrl'
               MUST use HTTPS protocol for security reasons
- api_key_scope: MUST be provided via Spark configuration as 'spark.env.apiKeyScope'
- api_key_secret: MUST be provided via Spark configuration as 'spark.env.apiKeySecret'

Parameters:
- experiment_id: Required UUID of the experiment
- pipeline_id: Optional ID of the created pipeline
- update_id: Optional ID of the pipeline update/run
- status: Optional manual override of the status (auto-detected if not provided)
"""

# This is a Databricks notebook, so `dbutils` and `spark` are globally available
# Adding type-ignores to prevent local linting errors
# type: ignore
import os
import json
import logging
import requests
from datetime import datetime
from enum import Enum
from typing import Dict, Any, Optional
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# COMMAND ----------

# DBTITLE 1,Configuration and Setup

# Define status enum to match Databricks SDK pipeline states
# Based on Databricks SDK pipeline and update states
class ProvisioningStatus(str, Enum):
    # Pipeline states
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    CANCELED = "CANCELED"
    
    # Additional pipeline/update states from Databricks SDK
    DEPLOYING = "DEPLOYING"
    DEPLOYED = "DEPLOYED"
    COMPLETED = "COMPLETED"
    QUEUED = "QUEUED"
    TERMINATED = "TERMINATED"
    WAITING = "WAITING"
    INITIALIZING = "INITIALIZING"
    IDLE = "IDLE"
    SETTING_UP = "SETTING_UP"
    RESETTING = "RESETTING"

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("experiment_status_updater")

# COMMAND ----------

# DBTITLE 1,Parameter Extraction

def extract_parameters() -> Dict[str, Any]:
    """Extract parameters from Databricks widgets with fallbacks to environment/spark configs."""
    
    # Always get webhook URL from spark configuration
    webhook_url = spark.conf.get("spark.env.webhookUrl")
    if not webhook_url:
        raise ValueError("Webhook URL not configured. Please provide it in spark.conf as 'spark.env.webhookUrl'.")
    
    # Validate that the webhook URL uses HTTPS
    if webhook_url and not webhook_url.lower().startswith("https://"):
        raise ValueError("Webhook URL must use HTTPS protocol.")
    
    # Get experiment ID
    experiment_id = dbutils.widgets.get("experiment_id")
    if not experiment_id:
        raise ValueError("Experiment ID is required")
    
    # Get pipeline ID
    pipeline_id = dbutils.widgets.get("pipeline_id")
    
    # Get update ID
    update_id = dbutils.widgets.get("update_id")
    
    # Get status - with auto-detection of prior task's status if not explicitly set
    status = dbutils.widgets.get("status")
    if not status or status == "":
        # Auto-detect status from job context
        try:
            # If we're in a job and have a parent task that failed, report failure
            # Otherwise assume success
            logger.info("Auto-detecting status from job context")
            
            # Get the job context from Databricks runtime
            job_context = json.loads(dbutils.notebook.entry_point.getDbutils().notebook().getContext().toJson())
            
            # Default to SUCCESS unless we find evidence of failure
            status = ProvisioningStatus.SUCCESS.value
            
            # Check if we're in a job context
            if job_context.get("currentRunId") and job_context.get("jobId"):
                logger.info(f"Running in job context: jobId={job_context.get('jobId')}, runId={job_context.get('currentRunId')}")
                
                # Look for parent task error in tags (set by Databricks job machinery)
                tags = job_context.get("tags", {})
                
                # Check for parent task failure indicators in tags
                parent_failure_indicators = [
                    "jobTaskParentFailed",
                    "taskFailed",
                    "jobParentTaskFailed"
                ]
                
                # Look for any failure indicators in the tags
                for indicator in parent_failure_indicators:
                    if any(tag.lower().startswith(indicator.lower()) for tag in tags):
                        logger.info(f"Detected failure indicator '{indicator}' in job tags")
                        status = ProvisioningStatus.FAILED.value
                        break
                
                # Also check for terminated status which could indicate cancellation
                if any(tag.lower().startswith("terminated") for tag in tags):
                    logger.info("Detected termination indicator in job tags")
                    status = ProvisioningStatus.CANCELED.value
                
                # If no failure indicators were found
                if status == ProvisioningStatus.SUCCESS.value:
                    logger.info("No failure indicators found in job context, reporting SUCCESS")
            else:
                # Not in a job context, default to SUCCESS
                logger.info("Not running in job context, defaulting to SUCCESS")
        except Exception as e:
            # If auto-detection fails, use SUCCESS as fallback
            logger.warning(f"Error auto-detecting status, defaulting to SUCCESS: {e}")
            status = ProvisioningStatus.SUCCESS.value
    else:
        logger.info(f"Using manually specified status: {status}")
    
    if status not in [s.value for s in ProvisioningStatus]:
        raise ValueError(f"Invalid status: {status}. Must be one of: {', '.join([s.value for s in ProvisioningStatus])}")
    
    # Get API key secret information from Spark configuration
    api_key_scope = spark.conf.get("spark.env.apiKeyScope")
    if not api_key_scope:
        raise ValueError("API key scope not configured. Please provide it in spark.conf as 'spark.env.apiKeyScope'.")
        
    api_key_secret = spark.conf.get("spark.env.apiKeySecret")
    if not api_key_secret:
        raise ValueError("API key secret not configured. Please provide it in spark.conf as 'spark.env.apiKeySecret'.")
    
    return {
        "webhook_url": webhook_url,
        "experiment_id": experiment_id,
        "pipeline_id": pipeline_id,
        "update_id": update_id,
        "status": status,
        "api_key_scope": api_key_scope,
        "api_key_secret": api_key_secret
    }

# COMMAND ----------

# DBTITLE 1,Webhook Client

class WebhookClient:
    """Client for sending status updates to the OpenJII backend webhook."""
    
    def __init__(self, webhook_url: str, api_key_scope: str, api_key_secret: str):
        self.webhook_url = webhook_url
        self.api_key = dbutils.secrets.get(scope=api_key_scope, key=api_key_secret)
        self.session = self._create_session()
    
    def _create_session(self) -> requests.Session:
        """Create HTTP session with retry logic."""
        session = requests.Session()
        retry = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST"]
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount("https://", adapter)
        return session
    
    def send_status_update(self, payload: Dict[str, Any], timeout: int = 30) -> Dict[str, Any]:
        """
        Send status update to webhook.
        
        Args:
            payload: Webhook payload
            timeout: Request timeout in seconds
            
        Returns:
            Response JSON
        """
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key
        }
        
        logger.info("Sending webhook request to webhook URL")
        
        try:
            response = self.session.post(
                self.webhook_url,
                json=payload,
                headers=headers,
                timeout=timeout
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Webhook request failed: {e}")
            if hasattr(e, 'response') and e.response:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response body: {e.response.text}")
            raise

# COMMAND ----------

# DBTITLE 1,Status Update Function

def create_status_payload(
    experiment_id: str,
    status: str,
    pipeline_id: Optional[str] = None,
    update_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create payload for status update webhook.
    
    Args:
        experiment_id: Experiment identifier
        status: Provisioning status
        pipeline_id: Optional DLT pipeline ID
        update_id: Optional DLT update ID
        
    Returns:
        Webhook payload
    """
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    
    payload = {
        "experimentId": experiment_id,
        "status": status,
        "timestamp": timestamp
    }
    
    # Add job and run IDs based on pipeline info if available
    if pipeline_id:
        payload["jobId"] = int(pipeline_id.split(":")[-1]) if ":" in pipeline_id else 0
    
    if update_id:
        payload["runId"] = int(update_id) if update_id.isdigit() else 0
        
    # Add workflow name
    payload["workflowName"] = "OpenJII Experiment Pipeline"
    
    return payload

# COMMAND ----------

# DBTITLE 1,Main Execution

def main() -> None:
    """Main execution function with error handling."""
    try:
        # Extract parameters
        params = extract_parameters()
        
        # Create webhook client
        client = WebhookClient(
            webhook_url=params["webhook_url"],
            api_key_scope=params["api_key_scope"],
            api_key_secret=params["api_key_secret"]
        )
        
        # Create payload
        payload = create_status_payload(
            experiment_id=params["experiment_id"],
            status=params["status"],
            pipeline_id=params["pipeline_id"],
            update_id=params["update_id"]
        )
        
        # Send update
        response = client.send_status_update(payload)
        
        # Print summary
        print("\n" + "="*50)
        print("Webhook Response Summary")
        print("="*50)
        print(f"Status: {response.get('status', 'Unknown')}")
        print(f"Message: {response.get('message', 'No message')}")
        print("="*50 + "\n")
        
        logger.info("Status update completed successfully")
        
        # Return result as JSON for programmatic access
        result = {
            "success": True,
            "status": params["status"],
            "experimentId": params["experiment_id"],
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "message": response.get('message', 'Status update completed successfully')
        }
        dbutils.notebook.exit(json.dumps(result))
        
    except Exception as e:
        error_message = str(e)
        logger.error(f"Status update failed: {error_message}")
            
        result = {
            "success": False,
            "status": "FAILURE",
            "error": error_message
        }
        dbutils.notebook.exit(json.dumps(result))

# Execute main function
if __name__ == "__main__":
    main()

# COMMAND ----------
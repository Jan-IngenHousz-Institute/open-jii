# Databricks notebook source
# DBTITLE 1,OpenJII Experiment Status Update Task
"""
This notebook sends experiment provisioning status updates to the OpenJII backend webhook.
It should be executed after the experiment pipeline creation task in a shared job.
"""
import json
import logging
import requests
import time
import hmac
import hashlib
from datetime import datetime
from enum import Enum
from typing import Dict, Any
from pyspark.dbutils import DBUtils
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
def extract_parameters(dbutils, spark) -> Dict[str, Any]:
    """Extract parameters from Databricks widgets."""

    # Always get webhook URL from widget
    webhook_url = dbutils.widgets.get("webhook_url")
    if not webhook_url:
        raise ValueError("Webhook URL not provided. Please provide it as a widget parameter 'webhook_url'.")

    # Validate that the webhook URL uses HTTPS
    if webhook_url and not webhook_url.lower().startswith("https://"):
        raise ValueError("Webhook URL must use HTTPS protocol.")
        
    # Validate that the webhook URL contains the :experimentId parameter
    if ":experimentId" not in webhook_url:
        raise ValueError("Webhook URL must contain ':experimentId' parameter.")

    # Get experiment ID
    experiment_id = dbutils.widgets.get("experiment_id")
    if not experiment_id:
        raise ValueError("Experiment ID is required")

    # Get job_run_id and task_run_id from Databricks job context
    job_context = dbutils.notebook.entry_point.getDbutils().notebook().getContext().toJson()
    job_context_dict = json.loads(job_context)
    job_run_id = job_context_dict.get("jobRunId")
    task_run_id = job_context_dict.get("currentTaskRunId")
    if not job_run_id:
        raise ValueError("Could not determine current job_run_id from Databricks job context.")
    if not task_run_id:
        raise ValueError("Could not determine current task_run_id from Databricks job context.")

    # Get status - with auto-detection of prior task's status if not explicitly set
    status = dbutils.widgets.get("status")
    if not status or status == "":
        # Auto-detect status from job context
        try:
            logger.info("Auto-detecting status from job context")
            
            # Default to SUCCESS unless we find evidence of failure
            status = ProvisioningStatus.SUCCESS.value
            
            # Check if we're in a job context
            if job_context_dict.get("currentRunId") and job_context_dict.get("jobId"):
                logger.info(f"Running in job context: jobId={job_context_dict.get('jobId')}, runId={job_context_dict.get('currentRunId')}")
                
                # Look for task status in job context
                task_status = job_context_dict.get("currentTaskStatus")
                if task_status:
                    if task_status.lower() == "failed":
                        status = ProvisioningStatus.FAILED.value
                    elif task_status.lower() == "canceled":
                        status = ProvisioningStatus.CANCELED.value
                    else:
                        status = ProvisioningStatus.SUCCESS.value
                else:
                    # Look for parent task error in tags (set by Databricks job machinery)
                    tags = job_context_dict.get("tags", {})
                    
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

    # Get API key scope from widgets
    key_scope = dbutils.widgets.get("key_scope")
    if not key_scope:
        raise ValueError("API key scope not provided. Please provide it as a widget parameter 'key_scope'.")

    return {
        "webhook_url": webhook_url,
        "experiment_id": experiment_id,
        "job_run_id": job_run_id,
        "task_run_id": task_run_id,
        "status": status,
        "key_scope": key_scope
    }

# COMMAND ----------

# DBTITLE 1,Webhook Client

class WebhookClient:
    """Client for sending status updates to the OpenJII backend webhook with HMAC authentication."""
    
    def __init__(self, webhook_url: str, key_scope: str, dbutils):
        self.webhook_url = webhook_url
        self.webhook_secret = dbutils.secrets.get(scope=key_scope, key="webhook_secret")
        self.api_key_id = dbutils.secrets.get(scope=key_scope, key="webhook_api_key_id")
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
    
    def _create_hmac_signature(self, payload: Dict[str, Any], timestamp: int) -> str:
        """
        Create HMAC signature for the webhook request.
        
        Args:
            payload: The payload to sign
            timestamp: Unix timestamp in seconds
            
        Returns:
            Hex digest of the HMAC signature
        """
        # Create canonical JSON string (sorted keys, compact representation)
        canonical_payload = json.dumps(payload, sort_keys=True, separators=(',', ':'))
        
        # Create payload string with timestamp prefix as required by the backend
        message = f"{timestamp}:{canonical_payload}"
        
        # Create HMAC signature using SHA-256
        signature = hmac.new(
            key=self.webhook_secret.encode('utf-8'),
            msg=message.encode('utf-8'),
            digestmod=hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def send_status_update(self, payload: Dict[str, Any], experiment_id: str, timeout: int = 30) -> Dict[str, Any]:
        """
        Send status update to webhook with HMAC authentication.
        
        Args:
            payload: Webhook payload
            experiment_id: ID of the experiment to update
            timeout: Request timeout in seconds
            
        Returns:
            Response JSON
        """
        # Create timestamp for request (seconds since epoch)
        timestamp = int(time.time())
        
        # Create HMAC signature
        signature = self._create_hmac_signature(payload, timestamp)
        
        # Set up headers with HMAC authentication
        headers = {
            "Content-Type": "application/json",
            "x-api-key-id": self.api_key_id,
            "x-databricks-signature": signature,
            "x-databricks-timestamp": str(timestamp)
        }
        
        try:
            # We need to use the canonical JSON in the actual request as well
            # to ensure the signature matches what was signed
            canonical_payload = json.dumps(payload, sort_keys=True, separators=(',', ':'))
            
            # Replace :experimentId placeholder in the webhook URL with the actual experiment ID
            webhook_url = self.webhook_url.replace(':experimentId', experiment_id)
            
            # Use data with explicit content-type to ensure the exact canonical format is preserved
            response = self.session.post(
                webhook_url,
                data=canonical_payload,
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

def create_status_payload(status: str, job_run_id: str, task_run_id: str) -> Dict[str, Any]:
    """
    Create payload for status update webhook.
    
    Args:
        status: Provisioning status
        job_run_id: Job run ID
        task_run_id: Task run ID
        
    Returns:
        Webhook payload
    """
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    return {
        "status": status,
        "timestamp": timestamp,
        "jobRunId": str(job_run_id),
        "taskRunId": str(task_run_id)
    }

# COMMAND ----------

# DBTITLE 1,Main Execution

def main() -> None:
    """Main execution function with error handling."""
    try:
        # Ensure spark is available (Databricks provides it as a global)
        global spark
        dbutils = DBUtils(spark)
        params = extract_parameters(dbutils, spark)
        
        # Create webhook client
        client = WebhookClient(
            webhook_url=params["webhook_url"],
            key_scope=params["key_scope"],
            dbutils=dbutils
        )
        
        # Create payload
        payload = create_status_payload(
            status=params["status"],
            job_run_id=params["job_run_id"],
            task_run_id=params["task_run_id"]
        )
        
        # Send update
        response = client.send_status_update(payload, params["experiment_id"])
        
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
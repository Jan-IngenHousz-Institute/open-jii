# Databricks notebook source
# DBTITLE 1,openJII Experiment Status Update Task
"""
This notebook sends experiment provisioning status updates to the openJII backend webhook.
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
from databricks.sdk import WorkspaceClient

# COMMAND ----------

# DBTITLE 1,Widget Setup
dbutils.widgets.text("create_result_state", "", "Status of experiment provisioning task")

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

# Mapping from Databricks result_state to ProvisioningStatus
DATABRICKS_RESULT_STATE_TO_PROVISIONING_STATUS = {
    "success": ProvisioningStatus.SUCCESS,
    "failed": ProvisioningStatus.FAILED,
    "canceled": ProvisioningStatus.CANCELED,
    "excluded": ProvisioningStatus.CANCELED,  # Map to CANCELED for lack of a better fit
    "evicted": ProvisioningStatus.FAILED,      # Map to FAILED
    "timedout": ProvisioningStatus.FAILED,     # Map to FAILED
    "upstream_canceled": ProvisioningStatus.CANCELED,
    "upstream_evicted": ProvisioningStatus.FAILED,
    "upstream_failed": ProvisioningStatus.FAILED,
}

def _normalize_status(status):
    # If status is an enum, get its value; otherwise, return as is
    if hasattr(status, "value"):
        return status.value
    # Map Databricks result_state to ProvisioningStatus
    s = str(status).lower()
    if s in DATABRICKS_RESULT_STATE_TO_PROVISIONING_STATUS:
        return DATABRICKS_RESULT_STATE_TO_PROVISIONING_STATUS[s].value
    # If already a valid ProvisioningStatus value, return as is (case-insensitive)
    for v in ProvisioningStatus:
        if s == v.value.lower():
            return v.value
    return status

def extract_parameters(dbutils) -> Dict[str, Any]:
    """Extract parameters from Databricks widgets, require status to be provided via widget (e.g., using dynamic value reference)."""
    # Get and validate webhook URL
    webhook_url = dbutils.widgets.get("webhook_url")
    if not webhook_url:
        raise ValueError("Webhook URL not provided. Please provide it as a widget parameter 'webhook_url'.")
    if not webhook_url.lower().startswith("https://"):
        raise ValueError("Webhook URL must use HTTPS protocol.")
    if ":id" not in webhook_url:
        raise ValueError("Webhook URL must contain ':id' parameter.")

    # Get and validate experiment ID
    experiment_id = dbutils.widgets.get("experiment_id")
    if not experiment_id:
        raise ValueError("Experiment ID is required.")

    # Get and validate job/task run IDs
    job_run_id = dbutils.widgets.get("job_run_id")
    task_run_id = dbutils.widgets.get("task_run_id")
    if not job_run_id or not task_run_id:
        raise ValueError(
            "Both job_run_id and task_run_id must be provided as widget parameters. "
            "Set these as job/task parameters in your job configuration (e.g., using ${job.runId} and ${current_run.id})."
        )

    # Get status, require it to be provided via widget (dynamic value reference)
    status = dbutils.widgets.get("create_result_state")
    if not status:
        raise ValueError(
            "Status not provided. Please set the 'status' widget using a Databricks dynamic value reference, "
            "such as {{tasks.<task_name>.result_state}}. See https://docs.databricks.com/aws/en/jobs/dynamic-value-references for details."
        )
    normalized_status = _normalize_status(status)
    logger.info(f"Using status from widget: {status} (normalized: {normalized_status})")

    # Accept both Databricks result states and ProvisioningStatus values
    valid_statuses = [s.value for s in ProvisioningStatus]
    valid_result_states = list(DATABRICKS_RESULT_STATE_TO_PROVISIONING_STATUS.keys())
    if normalized_status not in valid_statuses:
        raise ValueError(
            f"Invalid status: '{status}'. Must be one of: {', '.join(valid_result_states + valid_statuses)} "
            f"(case-insensitive, will be mapped to internal status)."
        )

    # Get and validate key scope
    key_scope = dbutils.widgets.get("key_scope")
    if not key_scope:
        raise ValueError("API key scope not provided. Please provide it as a widget parameter 'key_scope'.")

    return {
        "webhook_url": webhook_url,
        "experiment_id": experiment_id,
        "job_run_id": job_run_id,
        "task_run_id": task_run_id,
        "status": normalized_status,
        "key_scope": key_scope
    }

# COMMAND ----------

# DBTITLE 1,Webhook Client

class WebhookClient:
    """Client for sending status updates to the openJII backend webhook with HMAC authentication."""
    
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
            
            # Replace :id placeholder in the webhook URL with the actual experiment ID
            webhook_url = self.webhook_url.replace(':id', experiment_id)
            
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
        params = extract_parameters(dbutils)

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
        print(json.dumps(result))

        raise

# Execute main function
if __name__ == "__main__":
    main()

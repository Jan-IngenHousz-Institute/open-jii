# Databricks notebook source
# DBTITLE 1,Project Transfer Task
# Standalone task to execute a project transfer from an external platform (e.g., PhotosynQ).
# 1. Calls the backend webhook to create experiment, protocol, and macro
# 2. On success, saves parquet files into the data-imports volume for pipeline ingestion

# COMMAND ----------

# DBTITLE 1,Imports
import json
import logging
import os
from datetime import datetime
from typing import Dict, Any, Optional

from pyspark.sql import SparkSession
from pyspark.sql.types import (
    StructType,
    StructField,
    StringType,
    DoubleType,
    TimestampType,
    ArrayType,
    BooleanType,
)
from pyspark.dbutils import DBUtils

from enrich.backend_client import BackendClient, BackendIntegrationError

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# COMMAND ----------

# DBTITLE 1,Task Configuration
# Required parameters
TRANSFER_REQUEST_ID = dbutils.widgets.get("TRANSFER_REQUEST_ID")
CATALOG_NAME = dbutils.widgets.get("CATALOG_NAME")
ENVIRONMENT = (
    dbutils.widgets.get("ENVIRONMENT")
    if dbutils.widgets.get("ENVIRONMENT")
    else "dev"
)

# Backend webhook configuration (from secrets)
BACKEND_URL = dbutils.secrets.get(
    scope=f"project-transfer-{ENVIRONMENT}", key="backend-url"
)
WEBHOOK_API_KEY_ID = dbutils.secrets.get(
    scope=f"project-transfer-{ENVIRONMENT}", key="webhook-api-key-id"
)
WEBHOOK_SECRET = dbutils.secrets.get(
    scope=f"project-transfer-{ENVIRONMENT}", key="webhook-secret"
)

spark = SparkSession.builder.getOrCreate()
dbutils = DBUtils(spark)

logger.info(f"Starting project transfer task")
logger.info(f"Transfer request ID: {TRANSFER_REQUEST_ID}")
logger.info(f"Catalog: {CATALOG_NAME}")
logger.info(f"Environment: {ENVIRONMENT}")

# COMMAND ----------

# DBTITLE 1,Build Transfer Payload
def build_transfer_payload() -> Dict[str, Any]:
    """
    Build the payload for the project transfer webhook.

    TODO: Populate this from the actual transfer request data.
    This is a placeholder that should be replaced with logic to:
    - Read the transfer request details from the source platform
    - Extract experiment metadata, protocol code, macro code, etc.
    - Format questions for the flow graph

    Returns:
        Dictionary matching the ProjectTransferWebhookPayload schema
    """
    # TODO: Replace with actual data population logic
    # This placeholder demonstrates the expected structure
    payload = {
        "experiment": {
            "name": f"Transfer {TRANSFER_REQUEST_ID}",
            "description": "Transferred project - placeholder",
            "createdBy": "00000000-0000-0000-0000-000000000000",  # TODO: actual user ID
            "locations": [],
        },
        "protocol": {
            "name": f"Protocol for Transfer {TRANSFER_REQUEST_ID}",
            "description": "Transferred protocol - placeholder",
            "code": [{}],  # TODO: actual protocol code
            "family": "multispeq",
            "createdBy": "00000000-0000-0000-0000-000000000000",  # TODO: actual user ID
        },
        "macro": {
            "name": f"Macro for Transfer {TRANSFER_REQUEST_ID}",
            "description": "Transferred macro - placeholder",
            "language": "javascript",
            "code": "",  # TODO: actual base64 encoded macro code
            "createdBy": "00000000-0000-0000-0000-000000000000",  # TODO: actual user ID
        },
        "questions": [],  # TODO: actual questions from the source platform
    }

    return payload


# COMMAND ----------

# DBTITLE 1,Execute Project Transfer Webhook
def execute_transfer_webhook(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Call the backend project transfer webhook to create experiment, protocol, and macro.

    Args:
        payload: The project transfer webhook payload

    Returns:
        Response from the backend containing experimentId, protocolId, macroId, flowId

    Raises:
        BackendIntegrationError: If the webhook call fails
    """
    logger.info("Calling project transfer webhook")

    client = BackendClient(
        base_url=BACKEND_URL,
        api_key_id=WEBHOOK_API_KEY_ID,
        webhook_secret=WEBHOOK_SECRET,
        timeout=60,
    )

    endpoint = "/api/v1/webhooks/project-transfer"

    try:
        result = client._make_request(endpoint, payload)
    except BackendIntegrationError:
        raise
    except Exception as e:
        raise BackendIntegrationError(
            f"Unexpected error during project transfer webhook: {str(e)}"
        )

    # Validate response
    experiment_id = result.get("experimentId")
    if not experiment_id:
        raise BackendIntegrationError(
            f"Backend did not return experimentId in response: {result}"
        )

    protocol_id = result.get("protocolId")
    macro_id = result.get("macroId")
    flow_id = result.get("flowId")

    logger.info(f"Project transfer webhook successful")
    logger.info(f"  Experiment ID: {experiment_id}")
    logger.info(f"  Protocol ID:   {protocol_id}")
    logger.info(f"  Macro ID:      {macro_id}")
    logger.info(f"  Flow ID:       {flow_id}")

    return {
        "experimentId": experiment_id,
        "protocolId": protocol_id,
        "macroId": macro_id,
        "flowId": flow_id,
    }


# COMMAND ----------

# DBTITLE 1,Save Import Parquet Files
def save_import_parquet(
    experiment_id: str,
    protocol_id: str,
    macro_id: str,
    transfer_payload: Dict[str, Any],
):
    """
    Save parquet files into the data-imports volume for the pipeline to pick up.

    The files are written to:
      /Volumes/{catalog}/centrum/data-imports/{experiment_id}/photosynq_transfer/

    The schema matches what raw_imported_data expects in the centrum pipeline:
    same structure as clean_data output, with skip_macro_processing = True.

    TODO: Populate the DataFrame with actual measurement data from the source platform.

    Args:
        experiment_id: The created experiment's ID
        protocol_id: The created protocol's ID
        macro_id: The created macro's ID
        transfer_payload: The original transfer request payload (for metadata)
    """
    output_path = f"/Volumes/{CATALOG_NAME}/centrum/data-imports/{experiment_id}/photosynq_transfer"

    logger.info(f"Saving import parquet files to: {output_path}")

    # Define schema matching the imported data structure
    # This mirrors clean_data output columns plus import metadata
    import_schema = StructType(
        [
            StructField("id", StringType(), False),
            StructField("device_id", StringType(), True),
            StructField("device_name", StringType(), True),
            StructField("device_version", StringType(), True),
            StructField("device_battery", DoubleType(), True),
            StructField("device_firmware", StringType(), True),
            StructField("sample", StringType(), True),
            StructField("output", StringType(), True),
            StructField("user_id", StringType(), True),
            StructField("experiment_id", StringType(), False),
            StructField("protocol_id", StringType(), True),
            StructField("macro_id", StringType(), True),
            StructField("macro_filename", StringType(), True),
            StructField("timestamp", TimestampType(), True),
            StructField("date", StringType(), True),
            StructField("questions", StringType(), True),
            StructField("transfer_request_id", StringType(), True),
            StructField("source_platform", StringType(), True),
        ]
    )

    # TODO: Replace with actual measurement data from the source platform
    # This creates an empty DataFrame with the correct schema as a placeholder.
    # The actual data population should:
    # 1. Read measurement data from the source (PhotosynQ API, downloaded files, etc.)
    # 2. Transform it to match this schema
    # 3. Write the populated DataFrame as parquet
    df = spark.createDataFrame([], import_schema)

    # Write parquet files
    df.write.mode("overwrite").parquet(output_path)

    # Also write a transfer metadata file for provenance tracking
    metadata = {
        "transfer_request_id": TRANSFER_REQUEST_ID,
        "experiment_id": experiment_id,
        "protocol_id": protocol_id,
        "macro_id": macro_id,
        "source_platform": "photosynq",
        "transferred_at": datetime.now().isoformat(),
        "catalog_name": CATALOG_NAME,
        "environment": ENVIRONMENT,
    }

    metadata_path = f"{output_path}/_transfer_metadata.json"
    dbutils.fs.put(metadata_path, json.dumps(metadata, indent=2), overwrite=True)

    logger.info(f"Import parquet files saved successfully")
    logger.info(f"Transfer metadata written to: {metadata_path}")


# COMMAND ----------

# DBTITLE 1,Main Execution
def main():
    """
    Main execution function for the project transfer task.
    """
    logger.info("=" * 80)
    logger.info("Starting project transfer task")
    logger.info("=" * 80)

    # Step 1: Build the transfer payload
    logger.info("Step 1: Building transfer payload")
    payload = build_transfer_payload()
    logger.info(
        f"Transfer payload built for experiment: {payload['experiment']['name']}"
    )

    # Step 2: Call the backend webhook
    logger.info("Step 2: Executing project transfer webhook")
    result = execute_transfer_webhook(payload)

    experiment_id = result["experimentId"]
    protocol_id = result["protocolId"]
    macro_id = result["macroId"]

    if not experiment_id:
        logger.error("No experiment ID returned from webhook - failing the job")
        dbutils.notebook.exit(
            json.dumps({"status": "failed", "error": "No experiment ID returned"})
        )
        return

    # Step 3: Save import data as parquet files
    logger.info("Step 3: Saving import parquet files")
    save_import_parquet(experiment_id, protocol_id, macro_id, payload)

    # Prepare output
    output = {
        "status": "success",
        "transfer_request_id": TRANSFER_REQUEST_ID,
        "experiment_id": experiment_id,
        "protocol_id": protocol_id,
        "macro_id": macro_id,
        "flow_id": result.get("flowId"),
    }

    logger.info("=" * 80)
    logger.info("Project transfer task completed successfully")
    logger.info(f"  Experiment ID: {experiment_id}")
    logger.info(f"  Protocol ID:   {protocol_id}")
    logger.info(f"  Macro ID:      {macro_id}")
    logger.info("=" * 80)

    # Return results as notebook exit value
    dbutils.notebook.exit(json.dumps(output))


# Run main
main()

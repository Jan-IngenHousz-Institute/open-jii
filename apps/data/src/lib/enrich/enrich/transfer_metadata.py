"""
Project Transfer Enrichment

Provides utilities for executing project transfers by calling the backend
project-transfer webhook. Follows the same pattern as user_metadata.py:
takes a DataFrame, fetches secrets, calls the backend, returns enriched DataFrame.
"""

import json
import base64
import logging
from typing import Dict, Any, List, Optional

from pyspark.sql import DataFrame
from pyspark.sql.types import (
    StructType,
    StructField,
    StringType,
    BooleanType,
)

from .backend_client import BackendClient

logger = logging.getLogger(__name__)

# Output schema for the backend_transfer table
TRANSFER_RESULT_SCHEMA = StructType([
    StructField("transfer_id", StringType(), False),
    StructField("project_id", StringType(), True),
    StructField("creator_user_id", StringType(), True),
    StructField("experiment_id", StringType(), True),
    StructField("protocol_id", StringType(), True),
    StructField("macro_id", StringType(), True),
    StructField("macro_filename", StringType(), True),
    StructField("flow_id", StringType(), True),
    StructField("success", BooleanType(), False),
    StructField("error", StringType(), True),
])

_NAME_MAX_LENGTH = 255
_TRANSFER_SUFFIX = " (PhotosynQ)"


def _transfer_name(name: str) -> str:
    """Append a provenance suffix to the original name, truncating the base
    to stay within the 255-character database limit."""
    max_base = _NAME_MAX_LENGTH - len(_TRANSFER_SUFFIX)
    return name[:max_base] + _TRANSFER_SUFFIX


# PhotosynQ value_type → webhook question kind mapping
_VALUE_TYPE_TO_KIND = {
    "yes_no": "yes_no",
    "boolean": "yes_no",
    "number": "number",
    "numeric": "number",
    "integer": "number",
    "float": "number",
    "multi_choice": "multi_choice",
    "multiple_choice": "multi_choice",
    "select": "multi_choice",
}


def _build_protocol_payload(
    proto_list: Optional[List[Dict]], creator_user_id: str
) -> Optional[Dict[str, Any]]:
    """Build the protocol section of the webhook payload from the first protocol."""
    if not proto_list:
        return None
    proto = proto_list[0]
    code_val = proto.get("code")
    if isinstance(code_val, str):
        code_val = json.loads(code_val)
    if isinstance(code_val, dict):
        code_val = [code_val]
    return {
        "name": _transfer_name(proto["name"]),
        "description": proto.get("description"),
        "code": code_val,
        "family": proto.get("family"),
        "createdBy": creator_user_id,
    }


def _build_macro_payload(
    macro_list: Optional[List[Dict]], creator_user_id: str
) -> Optional[Dict[str, Any]]:
    """Build the macro section of the webhook payload from the first macro.
    Encodes javascript_code as base64 as required by the backend."""
    if not macro_list:
        return None
    macro = macro_list[0]
    raw_code = macro.get("code")
    b64_code = (
        base64.b64encode(raw_code.encode("utf-8")).decode("utf-8")
        if raw_code
        else None
    )
    return {
        "name": _transfer_name(macro["name"]),
        "description": macro.get("description"),
        "language": macro.get("language"),
        "code": b64_code,
        "createdBy": creator_user_id,
    }


def _build_questions_payload(
    questions_raw: Optional[List[Dict]],
) -> List[Dict[str, Any]]:
    """Map PhotosynQ questions to the ProjectTransferQuestionInput schema."""
    if not questions_raw:
        return []

    questions_payload = []
    for q in questions_raw:
        vt = (q.get("value_type") or "").lower()
        kind = _VALUE_TYPE_TO_KIND.get(vt, "open_ended")
        text = q.get("question_text") or q.get("label")
        text = text[:64] if text else text  # webhook max length

        entry: Dict[str, Any] = {"kind": kind, "text": text}
        opts = q.get("options")
        if opts:
            entry["options"] = list(opts)
        questions_payload.append(entry)

    return questions_payload


def _build_transfer_description(
    original_description: Optional[str],
    protocol_name: Optional[str],
    macro_name: Optional[str],
) -> str:
    """Build an enriched experiment description for transferred projects."""
    lines = [
        "This experiment has been automatically created and set up as part of a project transfer.",
        "",
    ]
    if protocol_name:
        lines.append(f'The protocol used in this experiment is "{protocol_name}".')
    if macro_name:
        lines.append(f'The macro used in this experiment is "{macro_name}".')
    if protocol_name or macro_name:
        lines.append("")

    lines.append(
        "The data is migrated from the original project without any re-processing. "
        "There may be discrepancies in how the data is presented."
    )

    if original_description:
        lines.append("")
        lines.append(original_description)

    return "\n".join(lines)


def _call_transfer_webhook(
    row: Dict[str, Any], client: BackendClient
) -> Dict[str, Any]:
    """
    Call the backend project-transfer webhook for a single transfer.

    Returns a dict matching TRANSFER_RESULT_SCHEMA fields.
    """
    transfer_id = row["transfer_id"]
    project_id = row["project_id"]
    creator_user_id = row["creator_user_id"]

    try:
        protocol_payload = _build_protocol_payload(
            row.get("protocols_list"), creator_user_id
        )
        macro_payload = _build_macro_payload(
            row.get("macros_list"), creator_user_id
        )
        questions_payload = _build_questions_payload(row.get("questions"))

        protocol_name = protocol_payload["name"] if protocol_payload else None
        macro_name = macro_payload["name"] if macro_payload else None

        description = _build_transfer_description(
            row.get("project_description"),
            protocol_name,
            macro_name,
        )

        payload: Dict[str, Any] = {
            "experiment": {
                "name": row.get("project_name"),
                "description": description,
                "createdBy": creator_user_id,
            },
        }
        if protocol_payload:
            payload["protocol"] = protocol_payload
        if macro_payload:
            payload["macro"] = macro_payload
        if questions_payload:
            payload["questions"] = questions_payload

        result = client._make_request(
            "/api/v1/webhooks/project-transfer", payload
        )

        return {
            "transfer_id": transfer_id,
            "project_id": project_id,
            "creator_user_id": creator_user_id,
            "experiment_id": result.get("experimentId"),
            "protocol_id": result.get("protocolId"),
            "macro_id": result.get("macroId"),
            "macro_filename": result.get("macroFilename"),
            "flow_id": result.get("flowId"),
            "success": True,
            "error": None,
        }

    except Exception as e:
        logger.error(f"Transfer {transfer_id} failed: {e}")
        return {
            "transfer_id": transfer_id,
            "project_id": project_id,
            "creator_user_id": creator_user_id,
            "experiment_id": None,
            "protocol_id": None,
            "macro_id": None,
            "macro_filename": None,
            "flow_id": None,
            "success": False,
            "error": str(e),
        }


def execute_transfers(df: DataFrame, environment: str, dbutils, spark) -> DataFrame:
    """
    Execute backend project-transfer webhooks for each transfer in the DataFrame.

    Expects a DataFrame with columns:
      transfer_id, project_id, project_name, project_description,
      creator_user_id, questions, protocols_list, macros_list

    Calls the backend once per transfer_id and returns a DataFrame with:
      transfer_id, project_id, creator_user_id,
      experiment_id, protocol_id, macro_id, flow_id, success, error

    Args:
        df: PySpark DataFrame with one row per transfer (pre-aggregated)
        environment: Environment name (dev, prod, etc.)
        dbutils: Databricks utilities instance for accessing secrets
        spark: SparkSession instance

    Returns:
        DataFrame with transfer results matching TRANSFER_RESULT_SCHEMA
    """
    scope = f"project-transfer-{environment}"
    client = BackendClient(
        base_url=dbutils.secrets.get(scope=scope, key="backend-url"),
        api_key_id=dbutils.secrets.get(scope=scope, key="webhook-api-key-id"),
        webhook_secret=dbutils.secrets.get(scope=scope, key="webhook-secret"),
        timeout=60,
    )

    rows = df.collect()
    results = [
        _call_transfer_webhook(row.asDict(recursive=True), client)
        for row in rows
    ]

    return spark.createDataFrame(results, schema=TRANSFER_RESULT_SCHEMA)

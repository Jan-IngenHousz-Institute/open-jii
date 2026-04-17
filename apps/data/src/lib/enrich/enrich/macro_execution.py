"""
Macro Execution via Backend API

Provides a pandas UDF factory for executing macros through the openJII
backend API (Lambda/Firecracker sandbox) instead of locally on Databricks.
Used to create a side-by-side comparison table for validating the sandbox
approach against the existing local macro execution.
"""

from typing import Any, Dict, List

import pandas as pd
from pyspark.sql.functions import pandas_udf
from pyspark.sql.types import MapType, StringType

from .backend_client import BackendClient, BackendIntegrationError


def make_execute_macro_udf():
    """
    Factory that reads Databricks secrets on the driver and returns a
    pandas UDF closed over those credentials.

    Returns:
        A pandas UDF (struct<id, macro_id, data> -> map<string, string>)
    """
    from pyspark.sql import SparkSession

    spark = SparkSession.getActiveSession()
    if spark is None:
        raise RuntimeError("No active SparkSession")

    dbutils = spark._jvm.com.databricks.dbutils.DBUtilsHolder.dbutils()
    base_url = dbutils.secrets().get("openJII-backend", "api-base-url")
    api_key_id = dbutils.secrets().get("openJII-backend", "api-key-id")
    webhook_secret = dbutils.secrets().get("openJII-backend", "webhook-secret")

    @pandas_udf(MapType(StringType(), StringType()))
    def execute_macro_udf(
        id_series: pd.Series,
        macro_id_series: pd.Series,
        data_series: pd.Series,
    ) -> pd.Series:
        """
        Execute macros via the backend batch endpoint.

        Inputs (one value per row, passed as separate Series from a struct):
            id_series: measurement id (string)
            macro_id_series: macro uuid (string)
            data_series: measurement payload (dict / JSON object)

        Returns:
            Series of map<string, string> with keys: macro_data, macro_error
        """
        n = len(id_series)
        items: List[Dict[str, Any]] = [
            {
                "id": str(id_series.iloc[i]),
                "macro_id": str(macro_id_series.iloc[i]),
                "data": data_series.iloc[i] if isinstance(data_series.iloc[i], dict) else {},
            }
            for i in range(n)
        ]

        client = BackendClient(
            base_url=base_url,
            api_key_id=api_key_id,
            webhook_secret=webhook_secret,
        )

        try:
            response = client.execute_macro_batch(items, timeout=30)
        except BackendIntegrationError:
            return pd.Series(
                [{"macro_data": None, "macro_error": "batch request failed"}] * n
            )

        results_by_id: Dict[str, Dict[str, Any]] = {}
        for r in response.get("results", []):
            rid = r.get("id")
            if rid is not None:
                results_by_id[rid] = r

        output: List[Dict[str, str]] = []
        for i in range(n):
            item_id = str(id_series.iloc[i])
            r = results_by_id.get(item_id)
            if r is None:
                output.append({"macro_data": None, "macro_error": "no result returned"})
            elif r.get("success"):
                import json
                macro_data = r.get("output", {})
                output.append({
                    "macro_data": json.dumps(macro_data) if isinstance(macro_data, dict) else str(macro_data),
                    "macro_error": None,
                })
            else:
                output.append({
                    "macro_data": None,
                    "macro_error": r.get("error", "unknown error"),
                })

        return pd.Series(output, dtype=object)

    return execute_macro_udf
"""
Macro Execution via Backend API

Provides a pandas UDF that calls the backend's /api/v1/macros/execute-batch
endpoint instead of running macros locally on Spark workers.

The backend:
  1. Groups items by macro_id
  2. Fetches macro scripts from the database
  3. Invokes the appropriate Lambda function (Python / JS / R)
  4. Returns results with output or error per item

This replaces the previous local macro execution approach which
ran unsandboxed code on Databricks workers.
"""

import json
from typing import Optional

import pandas as pd
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType

from .backend_client import BackendClient, BackendIntegrationError


# Schema returned by the pandas UDF
MACRO_RESULT_SCHEMA = StructType([
    StructField("result", StringType(), True),
    StructField("error", StringType(), True),
])


def make_execute_macro_udf(
    environment: str,
    dbutils,
    timeout: int = 30,
    max_batch_size: int = 500,
    scope_override: Optional[str] = None,
):
    """
    Create a pandas UDF that executes macros via the backend batch API.

    The UDF expects a struct column with fields:
      - id: row identifier (string)
      - macro_id: UUID of the macro to execute (string)
      - data: measurement data as a JSON string

    Returns a struct<result: string, error: string> where result is JSON.

    Args:
        environment: Environment name (dev, prod) for secrets scope.
        dbutils: Databricks dbutils for secrets retrieval.
        timeout: Per-Lambda timeout in seconds (1-60).
        max_batch_size: Max items per HTTP request to backend.
        scope_override: Override the secrets scope name (default: node-webhook-secret-scope-{env}).

    Returns:
        A pandas UDF function suitable for use with .withColumn().
    """
    # Read secrets on the driver (dbutils is not available on workers)
    scope = scope_override or f"node-webhook-secret-scope-{environment}"
    base_url = dbutils.secrets.get(scope=scope, key="webhook_base_url")
    api_key_id = dbutils.secrets.get(scope=scope, key="webhook_api_key_id")
    webhook_secret = dbutils.secrets.get(scope=scope, key="webhook_secret")

    @F.pandas_udf(returnType=MACRO_RESULT_SCHEMA)
    def execute_macro_udf(pdf: pd.DataFrame) -> pd.DataFrame:
        """
        Pandas UDF: sends items to backend /api/v1/macros/execute-batch.

        Input DataFrame columns: id, macro_id, data
        Output DataFrame columns: result (JSON string | None), error (string | None)
        """
        results = [None] * len(pdf)
        errors = [None] * len(pdf)

        # Build items list for the backend
        items = []
        idx_map = []  # maps backend item index -> original DataFrame index

        for pos, (df_idx, row) in enumerate(pdf.iterrows()):
            row_id = row.get("id")
            macro_id = row.get("macro_id")
            data = row.get("data")

            if pd.isna(macro_id) or pd.isna(data):
                errors[pos] = f"NULL macro_id or data for row {row_id}"
                continue

            items.append({
                "id": str(row_id),
                "macro_id": str(macro_id),
                "data": data,  # JSON string - backend's jsonStringOrValue handles parsing
            })
            idx_map.append(pos)

        if not items:
            return pd.DataFrame({"result": results, "error": errors})

        # Call the backend
        client = BackendClient(base_url, api_key_id, webhook_secret, timeout=max(timeout + 10, 60))

        try:
            response = client.execute_macro_batch(
                items=items,
                timeout=timeout,
                max_batch_size=max_batch_size,
            )
        except BackendIntegrationError as e:
            # Mark all items in this batch as failed
            for idx in idx_map:
                errors[idx] = f"Backend API error: {str(e)}"
            return pd.DataFrame({"result": results, "error": errors})

        # Map results back by item id
        result_by_id = {}
        for r in response.get("results", []):
            rid = r.get("id")
            if rid is not None:
                result_by_id[rid] = r

        for item, df_idx in zip(items, idx_map, strict=True):
            match = result_by_id.get(item["id"])
            if match is None:
                errors[df_idx] = f"No result returned for item {item['id']}"
            elif match.get("success"):
                results[df_idx] = json.dumps(match["output"]) if match.get("output") else None
                errors[df_idx] = None
            else:
                results[df_idx] = None
                errors[df_idx] = match.get("error", "Unknown error")

        return pd.DataFrame({"result": results, "error": errors})

    return execute_macro_udf
"""
Macro Execution via Backend API

Provides a pandas UDF that calls the backend's /api/v1/macros/execute-batch
endpoint instead of running macros locally on Spark workers.

The backend:
  1. Groups items by macro_id
  2. Fetches macro scripts from the database
  3. Invokes the appropriate Lambda function (Python / JS / R)
  4. Returns results with output or error per item

This replaces the previous local macro execution approach which
ran unsandboxed code on Databricks workers.
"""

import json
from typing import Optional

import pandas as pd
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType

from .backend_client import BackendClient, BackendIntegrationError


# Schema returned by the pandas UDF
MACRO_RESULT_SCHEMA = StructType([
    StructField("result", StringType(), True),
    StructField("error", StringType(), True),
])


def make_execute_macro_udf(
    environment: str,
    dbutils,
    timeout: int = 30,
    max_batch_size: int = 500,
    scope_override: Optional[str] = None,
):
    """
    Create a pandas UDF that executes macros via the backend batch API.

    The UDF expects a struct column with fields:
      - id: row identifier (string)
      - macro_id: UUID of the macro to execute (string)
      - data: measurement data as a JSON string

    Returns a struct<result: string, error: string> where result is JSON.

    Args:
        environment: Environment name (dev, prod) for secrets scope.
        dbutils: Databricks dbutils for secrets retrieval.
        timeout: Per-Lambda timeout in seconds (1-60).
        max_batch_size: Max items per HTTP request to backend.
        scope_override: Override the secrets scope name (default: node-webhook-secret-scope-{env}).

    Returns:
        A pandas UDF function suitable for use with .withColumn().
    """
    # Read secrets on the driver (dbutils is not available on workers)
    scope = scope_override or f"node-webhook-secret-scope-{environment}"
    base_url = dbutils.secrets.get(scope=scope, key="webhook_base_url")
    api_key_id = dbutils.secrets.get(scope=scope, key="webhook_api_key_id")
    webhook_secret = dbutils.secrets.get(scope=scope, key="webhook_secret")

    @F.pandas_udf(returnType=MACRO_RESULT_SCHEMA)
    def execute_macro_udf(pdf: pd.DataFrame) -> pd.DataFrame:
        """
        Pandas UDF: sends items to backend /api/v1/macros/execute-batch.

        Input DataFrame columns: id, macro_id, data
        Output DataFrame columns: result (JSON string | None), error (string | None)
        """
        results = [None] * len(pdf)
        errors = [None] * len(pdf)

        # Build items list for the backend
        items = []
        idx_map = []  # maps backend item index → original DataFrame index

        for pos, (df_idx, row) in enumerate(pdf.iterrows()):
            row_id = row.get("id")
            macro_id = row.get("macro_id")
            data = row.get("data")

            if pd.isna(macro_id) or pd.isna(data):
                errors[pos] = f"NULL macro_id or data for row {row_id}"
                continue

            items.append({
                "id": str(row_id),
                "macro_id": str(macro_id),
                "data": data,  # JSON string — backend's jsonStringOrValue handles parsing
            })
            idx_map.append(pos)

        if not items:
            return pd.DataFrame({"result": results, "error": errors})

        # Call the backend
        client = BackendClient(base_url, api_key_id, webhook_secret, timeout=max(timeout + 10, 60))

        try:
            response = client.execute_macro_batch(
                items=items,
                timeout=timeout,
                max_batch_size=max_batch_size,
            )
        except BackendIntegrationError as e:
            # Mark all items in this batch as failed
            for idx in idx_map:
                errors[idx] = f"Backend API error: {str(e)}"
            return pd.DataFrame({"result": results, "error": errors})

        # Map results back by item id
        result_by_id = {}
        for r in response.get("results", []):
            rid = r.get("id")
            if rid is not None:
                result_by_id[rid] = r

        for item, df_idx in zip(items, idx_map, strict=True):
            match = result_by_id.get(item["id"])
            if match is None:
                errors[df_idx] = f"No result returned for item {item['id']}"
            elif match.get("success"):
                results[df_idx] = json.dumps(match["output"]) if match.get("output") else None
                errors[df_idx] = None
            else:
                results[df_idx] = None
                errors[df_idx] = match.get("error", "Unknown error")

        return pd.DataFrame({"result": results, "error": errors})

    return execute_macro_udf

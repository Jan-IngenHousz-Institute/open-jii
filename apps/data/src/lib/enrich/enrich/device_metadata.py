"""
Device Registry Enrichment

Resolves the broker-authenticated client_id (== Thing name for X.509 devices) to
the platform device registry (uuid, serial, owner, status) from the openJII
backend API, mirroring user_metadata.add_user_column.
"""

from typing import Dict, Any, List
import pandas as pd
from pyspark.sql.types import StructType, StructField, StringType

from .backend_client import BackendClient


# device struct: STRUCT<id, serial_number, owner, status, device_type>
device_schema = StructType([
    StructField("id", StringType(), True),
    StructField("serial_number", StringType(), True),
    StructField("owner", StringType(), True),
    StructField("status", StringType(), True),
    StructField("device_type", StringType(), True),
])


def _fetch_device_registry(thing_names: List[str], backend_client: BackendClient) -> Dict[str, Dict[str, Any]]:
    if not thing_names:
        return {}
    try:
        return backend_client.get_device_registry(thing_names)
    except Exception as e:
        print(f"Error fetching device registry: {str(e)}")
        return {}


def add_device_registry(df, environment: str, dbutils):
    """
    Add a `device` struct resolved from the trusted client_id.

    Mirrors add_user_column: fetches the registry once per Spark batch, keyed by
    client_id (== Thing name for X.509 devices). Cognito/mobile client ids and
    NULLs match no registry row and resolve to a NULL struct.

    Args:
        df: PySpark DataFrame with a 'client_id' column
        environment: Environment name (dev, prod, etc.)
        dbutils: Databricks utilities instance for accessing secrets

    Returns:
        DataFrame with an added `device` STRUCT<id, serial_number, owner, status, device_type>.
    """
    from .backend_client import BackendClient
    from pyspark.sql import functions as F

    # Get secrets on driver node to pass to workers
    scope = f"node-webhook-secret-scope-{environment}"
    base_url = dbutils.secrets.get(scope=scope, key="webhook_base_url")
    api_key_id = dbutils.secrets.get(scope=scope, key="webhook_api_key_id")
    webhook_secret = dbutils.secrets.get(scope=scope, key="webhook_secret")

    @F.pandas_udf(device_schema)
    def get_devices(client_ids: pd.Series) -> pd.DataFrame:
        worker_client = BackendClient(base_url, api_key_id, webhook_secret)
        unique = [c for c in client_ids.dropna().unique().tolist() if str(c).strip()]
        registry = _fetch_device_registry(unique, worker_client)

        def extract(cid):
            if pd.isna(cid):
                return pd.Series([None, None, None, None, None])
            info = registry.get(cid, {})
            return pd.Series([
                info.get('id'),
                info.get('serialNumber'),
                info.get('createdBy'),
                info.get('status'),
                info.get('deviceType'),
            ])

        return client_ids.apply(extract)

    return df.withColumn("device", get_devices(F.col("client_id")))

"""
User Metadata Enrichment

Provides utilities for enriching Databricks DataFrames with user metadata
from the openJII backend API.
"""

from typing import Dict, Any, List
from uuid import UUID
import pandas as pd
from pyspark.sql.types import StructType, StructField, StringType

from .backend_client import BackendClient


def _is_uuid(value: str) -> bool:
    """The backend keys users by uuid; a non-uuid id 400s the whole batch."""
    try:
        UUID(value)
        return True
    except ValueError:
        return False


# Define user struct schema: STRUCT<id: STRING, name: STRING, avatar: STRING>
user_schema = StructType([
    StructField("id", StringType(), True),
    StructField("name", StringType(), True),
    StructField("avatar", StringType(), True)
])


def _fetch_user_metadata(user_ids: List[str], backend_client: BackendClient) -> Dict[str, Dict[str, Any]]:
    """
    Fetch user metadata from openJII backend API for the given user IDs.
    
    Args:
        user_ids: List of user IDs to fetch metadata for
        backend_client: Configured BackendClient instance
        
    Returns:
        Dictionary mapping user_id to user metadata
    """
    if not user_ids:
        return {}
    
    try:
        return backend_client.get_user_metadata(user_ids)
    except Exception as e:
        print(f"Error fetching user metadata: {str(e)}")
        return {}

def add_user_column(df, environment: str, dbutils):
    """
    Add user profile columns and user struct to DataFrame by calling backend API.
    
    Fetches user metadata once and adds all profile columns plus the user struct in a single pass.
    
    Args:
        df: PySpark DataFrame with 'user_id' column
        environment: Environment name (dev, prod, etc.)
        dbutils: Databricks utilities instance for accessing secrets
        
    Returns:
        DataFrame with additional columns: user
        The user column is a STRUCT<id: STRING, name: STRING, avatar: STRING>
    """
    from .backend_client import BackendClient
    from pyspark.sql import functions as F
    from pyspark.sql.types import StructType, StructField
    import traceback

    # Get secrets on driver node to pass to workers
    scope = f"node-webhook-secret-scope-{environment}"
    base_url = dbutils.secrets.get(scope=scope, key="webhook_base_url")
    api_key_id = dbutils.secrets.get(scope=scope, key="webhook_api_key_id")
    webhook_secret = dbutils.secrets.get(scope=scope, key="webhook_secret")

    # Profile + per-partition diagnostic error. `enrich_error` is null on
    # success and carries the raw exception (class + message + traceback)
    # when the API call fails so the materialized table is its own log.
    profile_schema = StructType([
        StructField("first_name",   StringType(), True),
        StructField("last_name",    StringType(), True),
        StructField("avatar_url",   StringType(), True),
        StructField("enrich_error", StringType(), True),
    ])

    @F.pandas_udf(profile_schema)
    def get_user_profiles(user_ids: pd.Series) -> pd.DataFrame:
        """Fetch all profile fields in a single API call."""
        worker_client = BackendClient(base_url, api_key_id, webhook_secret)
        unique_users = [uid for uid in user_ids.dropna().unique().tolist() if _is_uuid(uid)]

        # Call BackendClient.get_user_metadata directly so any exception
        # surfaces here; the helper `_fetch_user_metadata` swallows them.
        user_metadata: Dict[str, Dict[str, Any]] = {}
        batch_error = None
        try:
            user_metadata = worker_client.get_user_metadata(unique_users)
        except Exception as e:
            batch_error = (
                f"{type(e).__name__}: {str(e)}\n"
                f"unique_users={len(unique_users)}\n"
                f"{traceback.format_exc()}"
            )[:8000]  # keep the row small enough that Delta likes it

        def extract_profile(uid):
            if pd.isna(uid):
                return pd.Series([None, None, None, batch_error])
            user_info = user_metadata.get(uid, {})
            return pd.Series([
                user_info.get('firstName'),
                user_info.get('lastName'),
                user_info.get('avatarUrl'),
                batch_error,
            ])

        return user_ids.apply(extract_profile)

    # Expand the returned struct, then re-pack into the public `user` shape
    # plus the diagnostic `enrich_error` column.
    result_df = df.withColumn("_profile", get_user_profiles(F.col("user_id")))
    result_df = (result_df
        .withColumn("first_name",   F.col("_profile.first_name"))
        .withColumn("last_name",    F.col("_profile.last_name"))
        .withColumn("avatar_url",   F.col("_profile.avatar_url"))
        .withColumn("enrich_error", F.col("_profile.enrich_error"))
        .drop("_profile")
    )

    result_df = result_df.withColumn(
        "user",
        F.struct(
            F.col("user_id").alias("id"),
            F.concat_ws(" ", F.col("first_name"), F.col("last_name")).alias("name"),
            F.col("avatar_url").alias("avatar"),
        ),
    )

    result_df = result_df.drop("first_name", "last_name", "avatar_url")

    return result_df

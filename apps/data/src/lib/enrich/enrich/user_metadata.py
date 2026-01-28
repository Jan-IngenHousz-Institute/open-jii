"""
User Metadata Enrichment

Provides utilities for enriching Databricks DataFrames with user metadata
from the openJII backend API.
"""

from typing import Dict, Any, List
import pandas as pd
from pyspark.sql.types import StructType, StructField, StringType

from .backend_client import BackendClient

# Define user struct schema: STRUCT<id: STRING, name: STRING, image: STRING>
user_schema = StructType([
    StructField("id", StringType(), True),
    StructField("name", StringType(), True),
    StructField("image", StringType(), True)
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



def add_user_data_column(df, environment: str, dbutils):
    """
    Add user metadata columns to DataFrame by calling backend API.
    
    Args:
        df: PySpark DataFrame with 'user_id' column containing user IDs
        environment: Environment name (dev, prod, etc.)
        dbutils: Databricks utilities instance for accessing secrets
        
    Returns:
        DataFrame with additional user columns: user_id, user_name
    """
    from .backend_client import BackendClient
    from pyspark.sql import functions as F
    from pyspark.sql.types import StringType
    
    # Get secrets on driver node to pass to workers
    scope = f"node-webhook-secret-scope-{environment}"
    base_url = dbutils.secrets.get(scope=scope, key="webhook_base_url")
    api_key_id = dbutils.secrets.get(scope=scope, key="webhook_api_key_id")
    webhook_secret = dbutils.secrets.get(scope=scope, key="webhook_secret")
    
    @F.pandas_udf(StringType())
    def get_user_name(user_ids: pd.Series) -> pd.Series:
        """Get full names for user IDs"""
        # Create client on worker node using passed secrets
        worker_client = BackendClient(base_url, api_key_id, webhook_secret)
        
        unique_users = user_ids.dropna().unique().tolist()
        user_metadata = _fetch_user_metadata(unique_users, worker_client)
        
        def create_full_name(uid):
            if pd.isna(uid):
                return None
            user_info = user_metadata.get(uid, {})
            first_name = user_info.get('firstName')
            last_name = user_info.get('lastName')
            
            if first_name and last_name:
                return f"{first_name} {last_name}"
            elif first_name:
                return first_name
            elif last_name:
                return last_name
            return None
        
        return user_ids.map(create_full_name)
    
    # Add user_name column using user_id
    result_df = df.withColumn("user_name", get_user_name(F.col("user_id")))
    
    return result_df


def add_user_column(df, environment: str, dbutils):
    """
    Add user profile columns and user struct to DataFrame by calling backend API.
    
    Fetches user metadata once and adds all profile columns plus the user struct in a single pass.
    
    Args:
        df: PySpark DataFrame with 'user_id' column
        environment: Environment name (dev, prod, etc.)
        dbutils: Databricks utilities instance for accessing secrets
        
    Returns:
        DataFrame with additional columns: first_name, last_name, email, organization, avatar_url, user
        The user column is a STRUCT<id: STRING, name: STRING, image: STRING>
    """
    from .backend_client import BackendClient
    from pyspark.sql import functions as F
    from pyspark.sql.types import StructType, StructField
    
    # Get secrets on driver node to pass to workers
    scope = f"node-webhook-secret-scope-{environment}"
    base_url = dbutils.secrets.get(scope=scope, key="webhook_base_url")
    api_key_id = dbutils.secrets.get(scope=scope, key="webhook_api_key_id")
    webhook_secret = dbutils.secrets.get(scope=scope, key="webhook_secret")
    
    # Define schema for returned struct
    profile_schema = StructType([
        StructField("first_name", StringType(), True),
        StructField("last_name", StringType(), True),
        StructField("email", StringType(), True),
        StructField("organization", StringType(), True),
        StructField("avatar_url", StringType(), True)
    ])
    
    @F.pandas_udf(profile_schema)
    def get_user_profiles(user_ids: pd.Series) -> pd.DataFrame:
        """Fetch all profile fields in a single API call"""
        worker_client = BackendClient(base_url, api_key_id, webhook_secret)
        unique_users = user_ids.dropna().unique().tolist()
        user_metadata = _fetch_user_metadata(unique_users, worker_client)
        
        def extract_profile(uid):
            if pd.isna(uid):
                return pd.Series([None, None, None, None, None])
            user_info = user_metadata.get(uid, {})
            return pd.Series([
                user_info.get('firstName'),
                user_info.get('lastName'),
                user_info.get('email'),
                user_info.get('organization'),
                user_info.get('avatarUrl')
            ])
        
        return user_ids.apply(extract_profile)
    
    # Add profile struct column, then expand to individual columns
    result_df = df.withColumn("_profile", get_user_profiles(F.col("user_id")))
    result_df = (result_df
        .withColumn("first_name", F.col("_profile.first_name"))
        .withColumn("last_name", F.col("_profile.last_name"))
        .withColumn("email", F.col("_profile.email"))
        .withColumn("organization", F.col("_profile.organization"))
        .withColumn("avatar_url", F.col("_profile.avatar_url"))
        .drop("_profile")
    )
    
    # Add user struct column: STRUCT<id: STRING, name: STRING, image: STRING>
    result_df = result_df.withColumn(
        "user",
        F.struct(
            F.col("user_id").alias("id"),
            F.concat_ws(" ", F.col("first_name"), F.col("last_name")).alias("name"),
            F.col("avatar_url").alias("image")
        )
    )
    
    return result_df

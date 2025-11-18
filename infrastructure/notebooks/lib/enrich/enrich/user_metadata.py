"""
User Metadata Enrichment

Provides utilities for enriching Databricks DataFrames with user metadata
from the OpenJII backend API.
"""

from typing import Dict, Any, List
import pandas as pd

from .backend_client import BackendClient


def _fetch_user_metadata(user_ids: List[str], backend_client: BackendClient) -> Dict[str, Dict[str, Any]]:
    """
    Fetch user metadata from OpenJII backend API for the given user IDs.
    
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



def add_user_data_column(df, backend_client: BackendClient):
    """
    Add user metadata columns to DataFrame by calling backend API.
    
    Args:
        df: PySpark DataFrame with 'user_id' column containing user IDs
        backend_client: Pre-configured BackendClient instance
        
    Returns:
        DataFrame with additional user columns: user_id, user_name (removes user column if present)
    """
    from .backend_client import BackendClient
    from pyspark.sql import functions as F
    from pyspark.sql.types import StringType
    
    # Extract the configuration for serialization to worker nodes
    base_url = backend_client.base_url
    api_key_id = backend_client.api_key_id
    webhook_secret = backend_client.webhook_secret
    timeout = backend_client.timeout
    
    @F.pandas_udf(StringType())
    def get_user_name(user_ids: pd.Series) -> pd.Series:
        """Get full names for user IDs"""
        # Recreate client on worker node using serialized config
        worker_client = BackendClient(base_url, api_key_id, webhook_secret, timeout)
        
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

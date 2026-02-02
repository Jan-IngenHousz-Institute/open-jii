"""
User Metadata Enrichment

Provides utilities for enriching Databricks DataFrames with user metadata
from the openJII backend API.
"""

from typing import Dict, Any, List
import pandas as pd

from .backend_client import BackendClient


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


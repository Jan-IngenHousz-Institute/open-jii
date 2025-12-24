"""
Helper functions for PhotosynQ data analysis in Databricks.
"""

import pandas as pd


def read_table(table_name, limit=None, catalog="open_jii_data_hackathon", schema="default"):
    """
    Read a Delta table using Spark and convert to pandas DataFrame.
    
    Parameters:
    -----------
    table_name : str
        Name of the table (e.g., 'measurements_processed_sample')
    limit : int, optional
        Number of rows to return (useful for large tables)
    catalog : str, optional
        Catalog name (default: 'open_jii_data_hackathon')
    schema : str, optional
        Schema name (default: 'default')
    
    Returns:
    --------
    pd.DataFrame
        Pandas DataFrame with the table data
        
    Examples:
    ---------
    >>> # Load first 100 rows
    >>> df = read_table('measurements_processed_sample', limit=100)
    
    >>> # Load all rows (use with caution on large tables)
    >>> df = read_table('measurements_metadata')
    """
    # Import spark from globals (available in Databricks notebooks)
    from pyspark.sql import SparkSession
    spark = SparkSession.builder.getOrCreate()
    
    # Build fully qualified table name
    full_table_name = f"{catalog}.{schema}.{table_name}"
    
    # Read using Spark
    spark_df = spark.table(full_table_name)
    
    # Apply limit if specified
    if limit:
        spark_df = spark_df.limit(limit)
    
    # Convert to pandas
    return spark_df.toPandas()


def explode_set_data(df, set_column='set'):
    """
    Explode the nested 'set' array column to extract individual measurement records.
    Each element in the 'set' array becomes a separate row with its measurement data.
    
    The set column typically contains an array of structs with fields like:
    - temperature, temperature2: Temperature readings
    - humidity, humidity2: Humidity readings
    - light_intensity: Light sensor data
    - data_raw: Raw sensor data arrays
    - label: Measurement type description
    - And many more measurement fields
    
    Parameters:
    -----------
    df : pd.DataFrame
        DataFrame containing a 'set' column with nested measurement arrays
    set_column : str, optional
        Name of the column containing the nested arrays (default: 'set')
    
    Returns:
    --------
    pd.DataFrame
        Exploded DataFrame with one row per measurement in the set array.
        All nested struct fields are flattened into top-level columns.
        
    Examples:
    ---------
    >>> # Load and explode measurements
    >>> df = read_table('measurements_processed_sample', limit=100)
    >>> df_exploded = explode_set_data(df)
    >>> print(f"Exploded {len(df)} rows to {len(df_exploded)} measurements")
    
    >>> # Access individual measurement fields
    >>> print(df_exploded['temperature'].mean())
    >>> print(df_exploded['label'].value_counts())
    """
    # Explode the set array so each measurement becomes a row
    exploded = df.explode(set_column).reset_index(drop=True)
    
    # Extract nested fields from the set struct into separate columns
    set_data = pd.json_normalize(exploded[set_column])
    
    # Combine with the original columns (excluding the set column)
    result = pd.concat([
        exploded.drop(columns=[set_column]).reset_index(drop=True),
        set_data
    ], axis=1)
    
    return result

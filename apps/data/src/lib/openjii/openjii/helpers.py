"""
Helper functions for PhotosynQ data analysis in Databricks.
"""

import pandas as pd
from ._config import CATALOG_NAME


def read_table(table_name, schema, limit=None):
    """
    Read a Delta table using Spark and convert to pandas DataFrame.
    
    The catalog name is pre-configured when the package is built.
    You only need to specify the schema (e.g., experiment name) and table name.
    
    Parameters:
    -----------
    table_name : str
        Name of the table (e.g., 'measurements_processed_sample')
    schema : str
        Schema name (e.g., 'default', '33338-potato_grebbedijk_2025')
    limit : int, optional
        Number of rows to return (useful for large tables)
    
    Returns:
    --------
    pd.DataFrame
        Pandas DataFrame with the table data
        
    Examples:
    ---------
    >>> # Load first 100 rows from an experiment schema
    >>> df = read_table('enriched_sample', schema='33338-potato_grebbedijk_2025', limit=100)
    
    >>> # Load all rows (use with caution on large tables)
    >>> df = read_table('measurements_metadata', schema='default')
    """
    # Import spark from globals (available in Databricks notebooks)
    from pyspark.sql import SparkSession
    spark = SparkSession.builder.getOrCreate()
    
    # Build fully qualified table name using pre-configured catalog
    full_table_name = f"{CATALOG_NAME}.{schema}.{table_name}"
    
    # Read using Spark
    spark_df = spark.table(full_table_name)
    
    # Apply limit if specified
    if limit:
        spark_df = spark_df.limit(limit)
    
    # Convert to pandas
    return spark_df.toPandas()


def get_catalog_name():
    """
    Get the pre-configured catalog name for this package.
    
    Returns:
    --------
    str
        The catalog name configured at build time
        
    Examples:
    ---------
    >>> catalog = get_catalog_name()
    >>> print(f"Using catalog: {catalog}")
    """
    return CATALOG_NAME


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


def get_table_metadata(experiment_id, table_name, catalog_name, schema_name="centrum"):
    """
    Fetch metadata for a specific experiment table.
    
    Parameters:
    -----------
    experiment_id : str
        The experiment identifier
    table_name : str
        The table name (e.g., 'raw_data', 'device', or macro filename)
    catalog_name : str
        The catalog name (e.g., 'open_jii_dev')
    schema_name : str, optional
        The schema name (default: 'centrum')
    
    Returns:
    --------
    dict
        Dictionary with keys: table_name, row_count, macro_schema, questions_schema
    """
    from pyspark.sql import SparkSession
    from pyspark.sql.functions import col

    spark = SparkSession.builder.getOrCreate()
    
    metadata_df = (
        spark.table(f"{catalog_name}.{schema_name}.experiment_table_metadata")
        .filter((col("experiment_id") == experiment_id) & (col("table_name") == table_name))
        .select("table_name", "row_count", "macro_schema", "questions_schema")
    )
    
    rows = metadata_df.collect()
    if not rows:
        raise ValueError(f"No metadata found for experiment {experiment_id}, table {table_name}")
    
    row = rows[0]
    return {
        "table_name": row.table_name,
        "row_count": row.row_count,
        "macro_schema": row.macro_schema,
        "questions_schema": row.questions_schema,
    }


# Table type configuration: (source_table_name, order_by_column)
_TABLE_CONFIG = {
    "raw_data": ("enriched_experiment_raw_data", "timestamp"),
    "device": ("experiment_device_data", "processed_timestamp"),
    "raw_ambyte_data": ("enriched_raw_ambyte_data", "processed_at"),
    "macro": ("enriched_experiment_macro_data", "timestamp"),
}

_MACRO_EXCLUDE_COLS = ["raw_id", "macro_id", "macro_name", "macro_filename", "date"]


def load_experiment_table(experiment_id, table_name, catalog_name, schema_name="centrum"):
    """
    Load experiment data with proper variant parsing and column selection.
    
    This utility function handles:
    - Fetching table metadata with variant schemas
    - Loading from the correct source table
    - Parsing VARIANT columns (macro_output, questions_data)
    - Selecting/excluding appropriate columns
    - Ordering by correct timestamp column
    
    Parameters:
    -----------
    experiment_id : str
        The experiment identifier
    table_name : str
        The table name (e.g., 'raw_data', 'device', 'raw_ambyte_data', or macro filename)
    catalog_name : str
        The catalog name (e.g., 'open_jii_dev')
    schema_name : str, optional
        The schema name (default: 'centrum')
    
    Returns:
    --------
    DataFrame
        PySpark DataFrame with parsed variants and proper column selection
    """
    from pyspark.sql import SparkSession
    from pyspark.sql.functions import col, from_json
    
    spark = SparkSession.builder.getOrCreate()
    metadata = get_table_metadata(experiment_id, table_name, catalog_name, schema_name)
    
    # Normalize variant schemas for from_json compatibility (OBJECT → STRUCT)
    def normalize_schema(schema):
        return schema.replace("OBJECT<", "STRUCT<") if schema else None
    
    macro_schema = normalize_schema(metadata["macro_schema"])
    questions_schema = normalize_schema(metadata["questions_schema"])
    
    # Resolve table type: known names map directly, anything else is a macro
    table_type = table_name if table_name in {"raw_data", "device", "raw_ambyte_data"} else "macro"
    source_name, order_col = _TABLE_CONFIG[table_type]
    
    # Load and filter base dataframe
    source_table = f"{catalog_name}.{schema_name}.{source_name}"
    df = spark.table(source_table).filter(col("experiment_id") == experiment_id)
    
    if table_type == "macro":
        df = df.filter(col("macro_filename") == table_name)
    
    # Parse variant columns and build expansion/exclusion lists
    expand_cols = []
    exclude_cols = ["experiment_id"]
    
    if table_type == "macro":
        exclude_cols.extend(_MACRO_EXCLUDE_COLS)
    
    if table_type == "macro" and macro_schema:
        df = df.withColumn(
            "parsed_macro_output",
            from_json(col("macro_output").cast("string"), macro_schema),
        )
        expand_cols.append("parsed_macro_output.*")
        exclude_cols.extend(["macro_output", "parsed_macro_output"])
    
    if table_type in ("macro", "raw_data") and questions_schema:
        df = df.withColumn(
            "parsed_questions_data",
            from_json(col("questions_data").cast("string"), questions_schema),
        )
        expand_cols.append("parsed_questions_data.*")
        exclude_cols.extend(["questions_data", "parsed_questions_data"])
    
    # Expand parsed struct fields into top-level columns
    if expand_cols:
        df = df.select("*", *expand_cols)
    
    df = df.drop(*[c for c in exclude_cols if c in df.columns])
    
    return df.orderBy(order_col)

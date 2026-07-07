"""Helper functions for PhotosynQ data analysis in Databricks."""

from __future__ import annotations

import os

import pandas as pd


def get_catalog_name() -> str:
    """Resolve the configured catalog name for openJII tables.

    Resolution order:
      1. ``spark.conf`` key ``CATALOG_NAME`` (set by DLT pipelines or cluster config)
      2. Environment variable ``OPENJII_CATALOG``

    Raises:
        RuntimeError: if neither is set.
    """
    try:
        from pyspark.sql import SparkSession

        spark = SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()
        catalog = spark.conf.get("CATALOG_NAME", None)
        if catalog:
            return catalog
    except Exception:
        # Fall through to env var; raises below if both miss.
        pass

    catalog = os.environ.get("OPENJII_CATALOG")
    if catalog:
        return catalog

    raise RuntimeError(
        "Catalog not configured. Set spark.conf 'CATALOG_NAME' or env "
        "OPENJII_CATALOG (e.g. via cluster Spark config / pipeline config)."
    )


def read_table(table_name, schema, limit=None):
    """Read a Delta table using Spark and convert to pandas DataFrame.

    The catalog name is resolved at call time via :func:`get_catalog_name`.
    You only need to specify the schema (e.g., experiment name) and table name.

    Parameters
    ----------
    table_name : str
        Name of the table (e.g., 'measurements_processed_sample').
    schema : str
        Schema name (e.g., 'default', '33338-potato_grebbedijk_2025').
    limit : int, optional
        Number of rows to return (useful for large tables).

    Returns
    -------
    pd.DataFrame

    Examples
    --------
    >>> df = read_table('enriched_sample', schema='33338-potato_grebbedijk_2025', limit=100)
    """
    from pyspark.sql import SparkSession

    spark = SparkSession.builder.getOrCreate()
    full_table_name = f"{get_catalog_name()}.{schema}.{table_name}"
    spark_df = spark.table(full_table_name)
    if limit:
        spark_df = spark_df.limit(limit)
    return spark_df.toPandas()


def explode_set_data(df, set_column="set"):
    """Explode the nested 'set' array column into one row per measurement.

    The set column typically contains an array of structs with fields like
    temperature, humidity, light_intensity, data_raw, label, etc.

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame containing a column with nested measurement arrays.
    set_column : str, optional
        Name of the column containing the nested arrays (default: 'set').

    Returns
    -------
    pd.DataFrame
        Exploded DataFrame; nested struct fields flattened into top-level columns.
    """
    exploded = df.explode(set_column).reset_index(drop=True)
    set_data = pd.json_normalize(exploded[set_column])
    return pd.concat(
        [exploded.drop(columns=[set_column]).reset_index(drop=True), set_data],
        axis=1,
    )


def get_table_metadata(experiment_id, identifier, catalog_name, schema_name="centrum"):
    """Fetch metadata for a specific experiment table.

    Parameters
    ----------
    experiment_id : str
    identifier : str
        Table identifier (e.g., 'raw_data', 'device', or macro filename).
    catalog_name : str
    schema_name : str, optional
        Default ``'centrum'``.

    Returns
    -------
    dict
        Keys: identifier, row_count, macro_schema, questions_schema, custom_metadata_schema.
    """
    from pyspark.sql import SparkSession
    from pyspark.sql.functions import col

    spark = SparkSession.builder.getOrCreate()

    metadata_df = (
        spark.table(f"{catalog_name}.{schema_name}.experiment_table_metadata")
        .filter((col("experiment_id") == experiment_id) & (col("identifier") == identifier))
        .select("identifier", "row_count", "macro_schema", "questions_schema", "custom_metadata_schema")
    )

    rows = metadata_df.collect()
    if not rows:
        raise ValueError(f"No metadata found for experiment {experiment_id}, identifier {identifier}")

    row = rows[0]
    return {
        "identifier": row.identifier,
        "row_count": row.row_count,
        "macro_schema": row.macro_schema,
        "questions_schema": row.questions_schema,
        "custom_metadata_schema": row.custom_metadata_schema,
    }


# Table type configuration: (source_table_name, order_by_column)
_TABLE_CONFIG = {
    "raw_data": ("enriched_experiment_raw_data", "timestamp"),
    "device": ("experiment_device_data", "processed_timestamp"),
    "macro": ("enriched_experiment_macro_data", "timestamp"),
    "upload": ("enriched_experiment_uploaded_data", "uploaded_at"),
}

_MACRO_EXCLUDE_COLS = ["raw_id", "macro_id", "macro_name", "macro_filename", "date"]


def load_experiment_table(experiment_id, table_name, catalog_name, schema_name="centrum"):
    """Load experiment data with proper variant parsing and column selection.

    Handles fetching variant schemas, loading from the correct source table,
    parsing VARIANT columns (macro_output, questions_data), selecting columns,
    and ordering by the right timestamp column.
    """
    from pyspark.sql import SparkSession
    from pyspark.sql.functions import col, from_json

    spark = SparkSession.builder.getOrCreate()
    metadata = get_table_metadata(experiment_id, table_name, catalog_name, schema_name=schema_name)

    # Normalize variant schemas for from_json compatibility (OBJECT → STRUCT, VOID → STRING).
    # Match VOID only after ": " so we hit the type position, not a field identifier
    # that happens to contain the substring (e.g. "avoid"). DDL identifiers can't
    # contain ":" or spaces, so ": VOID" is unambiguous.
    def normalize_schema(schema):
        if not schema:
            return None
        return schema.replace("OBJECT<", "STRUCT<").replace(": VOID", ": STRING")

    macro_schema = normalize_schema(metadata["macro_schema"])
    questions_schema = normalize_schema(metadata["questions_schema"])

    # Resolve table type: known names map directly, anything else is a macro.
    table_type = table_name if table_name in _TABLE_CONFIG else "macro"
    source_name, order_col = _TABLE_CONFIG[table_type]

    source_table = f"{catalog_name}.{schema_name}.{source_name}"
    df = spark.table(source_table).filter(col("experiment_id") == experiment_id)

    if table_type == "macro":
        df = df.filter(col("macro_id") == table_name)

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

    if expand_cols:
        df = df.select("*", *expand_cols)

    df = df.drop(*[c for c in exclude_cols if c in df.columns])

    return df.orderBy(order_col)

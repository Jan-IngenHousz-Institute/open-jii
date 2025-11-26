"""
Annotations Metadata Enrichment

Provides utilities for enriching Databricks DataFrames with annotation data
from the experiment's annotations table.
"""

from pyspark.sql import functions as F
from pyspark.sql.types import StringType


def add_annotation_columns(df, table_name: str, catalog_name: str, experiment_schema: str, spark):
    """
    Add annotation data columns to DataFrame by joining with the annotations table.
    
    Args:
        df: PySpark DataFrame with 'id' column (used as row_id for joining)
        table_name: Name of the table being annotated (used to filter annotations)
        catalog_name: Databricks catalog name
        experiment_schema: Experiment schema name
        spark: SparkSession instance
        
    Returns:
        DataFrame with additional annotation columns:
        - annotation_author: user_id from annotations table
        - annotation_content: content_text from annotations table
        - annotation_type: type from annotations table
        
    Note:
        If the annotations table doesn't exist or an error occurs,
        the function will add null columns and continue without failing.
    """
    try:
        # Read annotations table (batch read since it's typically small)
        annotations_df = (
            spark.read.table(f"{catalog_name}.{experiment_schema}.annotations")
            .filter(F.col("table_name") == table_name)
            .select(
                F.col("row_id"),
                F.col("user_id").alias("annotation_author"),
                F.col("content_text").alias("annotation_content"),
                F.col("type").alias("annotation_type")
            )
        )
        
        # Left join with annotations (id from df = row_id from annotations)
        enriched_df = df.join(
            annotations_df,
            df.id == annotations_df.row_id,
            "left"
        ).drop("row_id")
        
        return enriched_df
        
    except Exception as e:
        print(f"Warning: Could not join with annotations table: {str(e)}")
        print("Continuing without annotation data...")
        # Return original df with null annotation columns
        return (
            df.withColumn("annotation_author", F.lit(None).cast(StringType()))
              .withColumn("annotation_content", F.lit(None).cast(StringType()))
              .withColumn("annotation_type", F.lit(None).cast(StringType()))
        )

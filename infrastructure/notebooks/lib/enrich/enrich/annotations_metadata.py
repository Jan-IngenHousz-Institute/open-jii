"""
Annotations Metadata Enrichment

Provides utilities for enriching Databricks DataFrames with annotation data
from the experiment's annotations table.
"""

from pyspark.sql import functions as F
from pyspark.sql.types import StringType, StructType, StructField, ArrayType, TimestampType


# Define annotation content schema (union type: comment or flag)
annotation_content_schema = StructType([
    StructField("text", StringType(), True),
    StructField("flagType", StringType(), True),
    StructField("reason", StringType(), True)
])

# Define annotation schema
annotation_schema = StructType([
    StructField("id", StringType(), True),
    StructField("rowId", StringType(), True),
    StructField("type", StringType(), True),
    StructField("content", annotation_content_schema, True),
    StructField("createdBy", StringType(), True),
    StructField("createdByName", StringType(), True),
    StructField("createdAt", TimestampType(), True),
    StructField("updatedAt", TimestampType(), True)
])


def add_annotation_column(df, table_name: str, catalog_name: str, experiment_schema: str, spark):
    """
    Add annotation data as an array of structs to DataFrame by joining with the annotations table.
    
    Args:
        df: PySpark DataFrame with 'id' column (used as row_id for joining)
        table_name: Name of the table being annotated (used to filter annotations)
        catalog_name: Databricks catalog name
        experiment_schema: Experiment schema name
        spark: SparkSession instance
        
    Returns:
        DataFrame with additional annotation column:
        - annotations: array<struct<
            id: string,
            rowId: string,
            type: string,
            content: struct<text: string, flagType: string, reason: string>,
            createdBy: string,
            createdByName: string,
            createdAt: timestamp,
            updatedAt: timestamp
          >>
        
        Note: content is a union type in TypeScript (comment or flag).
        In Spark, we store all possible fields and only the relevant ones are populated.
        
    Note:
        If the annotations table doesn't exist or an error occurs,
        the function will add an empty array column and continue without failing.
    """
    try:
        # Read annotations table with all fields
        # Parse the content JSON string into a proper struct
        annotations_df = (
            spark.read.table(f"{catalog_name}.{experiment_schema}.annotations")
            .filter(F.col("table_name") == table_name)
            .select(
                F.col("row_id"),
                F.struct(
                    F.col("id"),
                    F.col("row_id").alias("rowId"),
                    F.col("type"),
                    F.from_json(F.col("content_text"), "struct<text:string,flagType:string,reason:string>").alias("content"),
                    F.col("user_id").alias("createdBy"),
                    F.col("user_name").alias("createdByName"),
                    F.col("created_at").alias("createdAt"),
                    F.col("updated_at").alias("updatedAt")
                ).alias("annotation")
            )
        )
        
        # Group by row_id and collect all annotations into an array
        annotations_grouped = (
            annotations_df
            .groupBy("row_id")
            .agg(F.collect_list("annotation").alias("annotations"))
        )
        
        # Left join with annotations and handle null case
        enriched_df = (
            df.join(
                annotations_grouped,
                df.id == annotations_grouped.row_id,
                "left"
            )
            .drop("row_id")
            .withColumn(
                "annotations",
                F.when(F.col("annotations").isNull(), F.array()).otherwise(F.col("annotations"))
            )
        )
        
        return enriched_df
        
    except Exception as e:
        print(f"Warning: Could not join with annotations table: {str(e)}")
        print("Continuing without annotation data...")
        
        # Return original df with empty array column using the global schema definition
        return df.withColumn(
            "annotations",
            F.array().cast(ArrayType(annotation_schema))
        )

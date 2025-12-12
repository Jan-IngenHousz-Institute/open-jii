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
    If the DataFrame already has an 'annotations' column from upstream (e.g., from the payload),
    this function will merge those annotations with annotations from the database.
    
    Args:
        df: PySpark DataFrame with 'id' column (used as row_id for joining)
            May optionally have an existing 'annotations' column to merge with
        table_name: Name of the table being annotated (used to filter annotations)
        catalog_name: Databricks catalog name
        experiment_schema: Experiment schema name
        spark: SparkSession instance
        
    Returns:
        DataFrame with merged annotation column:
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
        The content_text column is reused for both comment text and flag reason.
        
    Note:
        If the annotations table doesn't exist or an error occurs,
        the function will preserve existing annotations or add an empty array column.
    """
    try:
        annotation_table_name = f"{catalog_name}.`{experiment_schema}`.annotations"
        print(f"Reading annotations from: {annotation_table_name}")
        print(f"Filtering by table_name: {table_name}")
        
        # Read annotations table with all fields
        # Build content struct from individual columns
        # Note: content_text is reused for both comment text and flag reason
        annotations_df = (
            spark.read.table(annotation_table_name)
            .filter(F.col("table_name") == table_name)
            .select(
                F.col("row_id"),
                F.struct(
                    F.col("id"),
                    F.col("row_id").alias("rowId"),
                    F.col("type"),
                    F.struct(
                        F.col("content_text").alias("text"),
                        F.col("flag_type").alias("flagType"),
                    ).alias("content"),
                    F.col("user_id").alias("createdBy"),
                    F.col("user_name").alias("createdByName"),
                    F.col("created_at").alias("createdAt"),
                    F.col("updated_at").alias("updatedAt")
                ).alias("annotation")
            )
        )
        
        annotation_count = annotations_df.count()
        print(f"Found {annotation_count} annotations for table '{table_name}'")
        
        
        # Group by row_id and collect all annotations into an array
        annotations_grouped = (
            annotations_df
            .groupBy("row_id")
            .agg(F.collect_list("annotation").alias("annotations"))
        )
        
        grouped_count = annotations_grouped.count()
        print(f"Grouped into {grouped_count} unique row_ids")
        
        # Check if DataFrame already has an annotations column from upstream
        has_existing_annotations = "annotations" in df.columns
        
        if has_existing_annotations:
            print("Found existing annotations column from upstream - will merge with database annotations")
            # Rename existing annotations to avoid conflict during join
            df = df.withColumnRenamed("annotations", "upstream_annotations")
        
        # Left join with annotations from database
        enriched_df = (
            df.join(
                annotations_grouped,
                df.id == annotations_grouped.row_id,
                "left"
            )
            .drop("row_id")
        )
        
        if has_existing_annotations:
            # Merge upstream annotations with database annotations
            # Use concat to combine both arrays, handling nulls appropriately
            enriched_df = enriched_df.withColumn(
                "annotations",
                F.concat(
                    F.coalesce(F.col("upstream_annotations"), F.array()),
                    F.coalesce(F.col("annotations"), F.array())
                )
            ).drop("upstream_annotations")
            print("Merged upstream annotations with database annotations")
        else:
            # No existing annotations, just use database annotations or empty array
            enriched_df = enriched_df.withColumn(
                "annotations",
                F.when(F.col("annotations").isNull(), F.array()).otherwise(F.col("annotations"))
            )
        
        print(f"Join completed successfully")
        
        return enriched_df
        
    except Exception as e:
        print(f"Warning: Could not join with annotations table: {str(e)}")
        print("Continuing without database annotation data...")
        
        # Check if DataFrame already has annotations from upstream
        if "annotations" in df.columns:
            print("Preserving existing annotations from upstream")
            return df
        else:
            # Return original df with empty array column using the global schema definition
            return df.withColumn(
                "annotations",
                F.array().cast(ArrayType(annotation_schema))
            )

from pyspark.sql import functions as F
from pyspark.sql.types import StringType
from pyspark.sql import SparkSession

spark = SparkSession.builder.getOrCreate()


# DBTITLE 1,Helper Functions for Questions Processing
def get_experiment_question_labels(catalog_name, central_schema, central_silver_table, experiment_id):
    """
    Discover all unique question labels used in the experiment.
    Similar to how we discover macros, but for question labels.
    """
    try:
        # Get all unique question labels from the experiment
        question_labels_df = (
            spark.read.table(
                f"{catalog_name}.{central_schema}.{central_silver_table}"
            )
            .filter(F.col("experiment_id") == experiment_id)
            .filter(F.col("questions").isNotNull())
            .filter(F.size(F.col("questions")) > 0)
            .select(F.explode(F.col("questions")).alias("question_struct"))
            .select(
                F.col("question_struct.question_label").alias("question_label")
            )
            .filter(F.col("question_label").isNotNull())
            .dropDuplicates(["question_label"])
        )
        
        question_labels = [row.question_label for row in question_labels_df.collect()]
        print(f"Discovered question labels for experiment {experiment_id}: {question_labels}")
        return question_labels
    except Exception as e:
        print(f"Error discovering question labels: {str(e)}")
        return []

def _sanitize_column_name(label):
    """
    Sanitize question label to make it a valid column name.
    Removes or replaces invalid characters: ' ,;{}()\n\t='
    Converts to lowercase for consistency.
    """
    import re
    # Convert to lowercase first
    sanitized = label.lower()
    # Replace invalid characters with underscores
    sanitized = re.sub(r'[ ,;{}()\n\t=]+', '_', sanitized)
    # Remove leading/trailing underscores and multiple consecutive underscores
    sanitized = re.sub(r'^_+|_+$', '', sanitized)
    sanitized = re.sub(r'_+', '_', sanitized)
    # Ensure it's not empty and doesn't start with a number
    if not sanitized or sanitized[0].isdigit():
        sanitized = f"question_{sanitized}"
    return sanitized

def add_question_columns(df, question_labels):
    """
    Add individual question columns to a DataFrame by extracting answers
    from the questions array based on discovered question labels.
    
    Args:
        df: DataFrame containing the questions array column
        question_labels: List of question labels to create columns for
    
    Returns:
        DataFrame with additional question columns
    """
    result_df = df
    
    for label in question_labels:
        # Sanitize the label for use as column name
        sanitized_label = _sanitize_column_name(label)
        
        # Create a column for each question label by finding the matching answer
        # Use filter + first to get the answer for the specific question label
        # Note: We still use the original label for filtering, but sanitized for column name
        result_df = result_df.withColumn(
            sanitized_label,
            F.when(
                F.col("questions").isNotNull() & (F.size(F.col("questions")) > 0),
                F.expr(f"""
                    transform(
                        filter(questions, q -> q.question_label = '{label}'),
                        q -> q.question_answer
                    )[0]
                """)
            ).otherwise(F.lit(None).cast(StringType()))
        )
    
    return result_df

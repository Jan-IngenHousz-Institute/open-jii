terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

# Create the experiment-specific schema
resource "databricks_schema" "experiment" {
  provider     = databricks.workspace
  catalog_name = var.catalog_name
  name         = var.schema_name
  comment      = var.schema_comment
}

# Experiment-specific silver layer table
resource "databricks_sql_table" "clean_data" {
  provider     = databricks.workspace
  count        = var.create_medallion_tables ? 1 : 0
  catalog_name = var.catalog_name
  schema_name  = var.schema_name
  name         = "clean_data_exp"
  comment      = "Silver layer: Experiment-specific cleaned and validated data"

  column {
    name = "sensor_id"
    type = "STRING"
  }
  column {
    name = "timestamp"
    type = "TIMESTAMP"
  }
  column {
    name = "value"
    type = "DOUBLE"
  }
  column {
    name = "experiment_id"
    type = "STRING"
  }
  column {
    name = "quality_check_passed"
    type = "BOOLEAN"
  }
  column {
    name = "experiment_specific_flag"
    type = "STRING"
  }
  column {
    name = "processed_timestamp"
    type = "TIMESTAMP"
  }

  table_type         = "MANAGED"
  data_source_format = "DELTA"

  depends_on = [databricks_schema.experiment]
}

# Experiment-specific gold layer table
resource "databricks_sql_table" "analytics_data" {
  provider     = databricks.workspace
  count        = var.create_medallion_tables ? 1 : 0
  catalog_name = var.catalog_name
  schema_name  = var.schema_name
  name         = "analytics_data_exp"
  comment      = "Gold layer: Experiment-specific analytics-ready aggregated data"

  column {
    name = "sensor_id"
    type = "STRING"
  }
  column {
    name = "date"
    type = "DATE"
  }
  column {
    name = "experiment_id"
    type = "STRING"
  }
  column {
    name = "min_value"
    type = "DOUBLE"
  }
  column {
    name = "max_value"
    type = "DOUBLE"
  }
  column {
    name = "avg_value"
    type = "DOUBLE"
  }
  column {
    name = "reading_count"
    type = "LONG"
  }
  column {
    name = "experiment_specific_metric"
    type = "DOUBLE"
  }

  table_type         = "MANAGED"
  data_source_format = "DELTA"

  depends_on = [databricks_schema.experiment]
}

# Experiment metadata table
resource "databricks_sql_table" "experiment_metadata" {
  provider     = databricks.workspace
  count        = var.create_metadata_tables ? 1 : 0
  catalog_name = var.catalog_name
  schema_name  = var.schema_name
  name         = "experiment_metadata"
  comment      = "Metadata specific to this experiment"

  column {
    name = "experiment_id"
    type = "STRING"
  }
  column {
    name = "parameter_name"
    type = "STRING"
  }
  column {
    name = "parameter_value"
    type = "STRING"
  }
  column {
    name = "description"
    type = "STRING"
  }
  column {
    name = "last_updated"
    type = "TIMESTAMP"
  }
  column {
    name = "updated_by"
    type = "STRING"
  }

  table_type         = "MANAGED"
  data_source_format = "DELTA"

  depends_on = [databricks_schema.experiment]
}

# Plant metadata table
resource "databricks_sql_table" "plant_metadata" {
  provider     = databricks.workspace
  count        = var.create_metadata_tables ? 1 : 0
  catalog_name = var.catalog_name
  schema_name  = var.schema_name
  name         = "plant_metadata"
  comment      = "Metadata about plants in this experiment"

  column {
    name = "plant_id"
    type = "STRING"
  }
  column {
    name = "experiment_id"
    type = "STRING"
  }
  column {
    name = "species"
    type = "STRING"
  }
  column {
    name = "variety"
    type = "STRING"
  }
  column {
    name = "planting_date"
    type = "DATE"
  }
  column {
    name = "treatment_group"
    type = "STRING"
  }
  column {
    name = "location_in_experiment"
    type = "STRING"
  }
  column {
    name = "growth_stage"
    type = "STRING"
  }
  column {
    name = "health_status"
    type = "STRING"
  }
  column {
    name = "notes"
    type = "STRING"
  }
  
  # Plant genotype information from MQTT client
  column {
    name = "plant_genotype"
    type = "STRING"
  }
  
  # Additional annotation fields for data analysts
  column {
    name = "custom_annotations"
    type = "MAP<STRING,STRING>"
    comment = "Flexible key-value pairs for custom annotations"
  }
  column {
    name = "phenotypic_observations"
    type = "STRUCT<observation_date:DATE, height:DOUBLE, leaf_count:INT, color:STRING, additional_notes:STRING>"
    comment = "Structured phenotypic observations over time"
  }
  column {
    name = "environmental_conditions"
    type = "MAP<STRING,DOUBLE>"
    comment = "Environmental conditions specific to this plant's location"
  }
  column {
    name = "image_references"
    type = "ARRAY<STRUCT<image_date:DATE, image_url:STRING, image_type:STRING, notes:STRING>>"
    comment = "References to plant images for visual tracking"
  }
  column {
    name = "experimental_results"
    type = "STRING"
    comment = "Summary of experiment-specific results for this plant"
  }
  
  # Tracking columns
  column {
    name = "last_updated"
    type = "TIMESTAMP"
  }
  column {
    name = "updated_by"
    type = "STRING"
  }
  column {
    name = "annotation_history"
    type = "ARRAY<STRUCT<timestamp:TIMESTAMP, field:STRING, old_value:STRING, new_value:STRING, updated_by:STRING>>"
    comment = "History of annotations and changes"
  }

  table_type         = "MANAGED"
  data_source_format = "DELTA"

  depends_on = [databricks_schema.experiment]
}

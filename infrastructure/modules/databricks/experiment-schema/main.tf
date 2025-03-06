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

  properties = {
    "delta.columnMapping.mode" = "name"
    "delta.minReaderVersion"   = "2"
    "delta.minWriterVersion"   = "5"
  }

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

  properties = {
    "delta.columnMapping.mode" = "name"
  }

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

  properties = {
    "delta.columnMapping.mode" = "name"
  }

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


  # Tracking columns
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

  # Adding column mapping properties required for schema evolution
  properties = {
    "delta.columnMapping.mode" = "name"
  }

  depends_on = [databricks_schema.experiment]
}

terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

# Create the schema in the specified catalog
resource "databricks_schema" "this" {
  provider     = databricks.workspace
  catalog_name = var.catalog_name
  name         = var.schema_name
  comment      = var.schema_comment
}

# Central metadata table for experiments
resource "databricks_sql_table" "experiments" {
  provider     = databricks.workspace
  catalog_name = var.catalog_name
  schema_name  = var.schema_name
  name         = "experiments"
  comment      = "Table holding metadata for experiments."

  column {
    name = "experiment_id"
    type = "STRING"
  }
  column {
    name = "experiment_name"
    type = "STRING"
  }
  column {
    name = "schema_name"
    type = "STRING"
  }
  column {
    name = "start_date"
    type = "TIMESTAMP"
  }
  column {
    name = "end_date"
    type = "TIMESTAMP"
  }
  column {
    name = "status"
    type = "STRING"
  }
  column {
    name = "description"
    type = "STRING"
  }
  column {
    name = "owner"
    type = "STRING"
  }
  column {
    name = "tags"
    type = "MAP<STRING,STRING>"
  }

  table_type         = "MANAGED"
  data_source_format = "DELTA"
}

# Bronze layer for raw sensor data
# resource "databricks_sql_table" "raw_data" {
#   provider     = databricks.workspace
#   count        = var.create_medallion_tables ? 1 : 0
#   catalog_name = var.catalog_name
#   schema_name  = var.schema_name
#   name         = "raw_data"
#   comment      = "Bronze layer: Raw sensor data ingested from sources."

#   column {
#     name = "topic"
#     type = "STRING"
#   }
#   column {
#     name = "experiment_id"
#     type = "STRING"
#   }
#   column {
#     name = "device_type"
#     type = "STRING"
#   }
#   column {
#     name = "device_version"
#     type = "STRING"
#   }
#   column {
#     name = "sensor_id"
#     type = "STRING"
#   }
#   column {
#     name = "measurement_type"
#     type = "STRING"
#   }
#   column {
#     name = "timestamp"
#     type = "TIMESTAMP"
#   }
#   column {
#     name = "measurement_value"
#     type = "DOUBLE"
#   }
#   column {
#     name = "notes"
#     type = "STRING"
#   }
#   column {
#     name = "protocol"
#     type = "STRING"
#   }
#   column {
#     name = "device_name"
#     type = "STRING"
#   }
#   column {
#     name = "device_id"
#     type = "STRING"
#   }
#   column {
#     name = "device_battery"
#     type = "DOUBLE"
#   }
#   column {
#     name = "device_firmware"
#     type = "DOUBLE"
#   }
#   column {
#     name = "plant_name"
#     type = "STRING"
#   }
#   column {
#     name = "plant_genotype"
#     type = "STRING"
#   }
#   column {
#     name = "plant_id"
#     type = "STRING"
#   }
#   column {
#     name = "plant_location"
#     type = "INT"
#   }
#   column {
#     name = "raw_payload"
#     type = "STRING"
#   }
#   column {
#     name = "ingest_timestamp"
#     type = "TIMESTAMP"
#   }

#   table_type         = "MANAGED"
#   data_source_format = "DELTA"
# }

# Silver layer for clean, transformed data
# resource "databricks_sql_table" "clean_data" {
#   provider     = databricks.workspace
#   count        = var.create_medallion_tables ? 1 : 0
#   catalog_name = var.catalog_name
#   schema_name  = var.schema_name
#   name         = "clean_data"
#   comment      = "Silver layer: Cleaned and validated sensor data."

#   column {
#     name = "sensor_id"
#     type = "STRING"
#   }
#   column {
#     name = "timestamp"
#     type = "TIMESTAMP"
#   }
#   column {
#     name = "value"
#     type = "DOUBLE"
#   }
#   column {
#     name = "experiment_id"
#     type = "STRING"
#   }
#   column {
#     name = "quality_check_passed"
#     type = "BOOLEAN"
#   }
#   column {
#     name = "processed_timestamp"
#     type = "TIMESTAMP"
#   }

#   table_type         = "MANAGED"
#   data_source_format = "DELTA"
# }

# # Gold layer for analytics-ready aggregated data
# resource "databricks_sql_table" "analytics_data" {
#   provider     = databricks.workspace
#   count        = var.create_medallion_tables ? 1 : 0
#   catalog_name = var.catalog_name
#   schema_name  = var.schema_name
#   name         = "analytics_data"
#   comment      = "Gold layer: Analytics-ready aggregated data."

#   column {
#     name = "sensor_id"
#     type = "STRING"
#   }
#   column {
#     name = "date"
#     type = "DATE"
#   }
#   column {
#     name = "experiment_id"
#     type = "STRING"
#   }
#   column {
#     name = "min_value"
#     type = "DOUBLE"
#   }
#   column {
#     name = "max_value"
#     type = "DOUBLE"
#   }
#   column {
#     name = "avg_value"
#     type = "DOUBLE"
#   }
#   column {
#     name = "reading_count"
#     type = "LONG"
#   }

#   table_type         = "MANAGED"
#   data_source_format = "DELTA"
# }

# # Additional metadata tables
# resource "databricks_sql_table" "sensor_metadata" {
#   provider     = databricks.workspace
#   count        = var.create_metadata_tables ? 1 : 0
#   catalog_name = var.catalog_name
#   schema_name  = var.schema_name
#   name         = "sensor_metadata"
#   comment      = "Metadata about sensors used in experiments."

#   column {
#     name = "sensor_id"
#     type = "STRING"
#   }
#   column {
#     name = "sensor_type"
#     type = "STRING"
#   }
#   column {
#     name = "manufacturer"
#     type = "STRING"
#   }
#   column {
#     name = "model"
#     type = "STRING"
#   }
#   column {
#     name = "installation_date"
#     type = "DATE"
#   }
#   column {
#     name = "calibration_date"
#     type = "DATE"
#   }
#   column {
#     name = "location_info"
#     type = "MAP<STRING,STRING>"
#   }

#   table_type         = "MANAGED"
#   data_source_format = "DELTA"
# }

# resource "databricks_sql_table" "plant_metadata" {
#   provider     = databricks.workspace
#   count        = var.create_metadata_tables ? 1 : 0
#   catalog_name = var.catalog_name
#   schema_name  = var.schema_name
#   name         = "plant_metadata"
#   comment      = "Metadata about plants in experiments."

#   column {
#     name = "plant_id"
#     type = "STRING"
#   }
#   column {
#     name = "experiment_id"
#     type = "STRING"
#   }
#   column {
#     name = "species"
#     type = "STRING"
#   }
#   column {
#     name = "variety"
#     type = "STRING"
#   }
#   column {
#     name = "planting_date"
#     type = "DATE"
#   }
#   column {
#     name = "treatment_group"
#     type = "STRING"
#   }
#   column {
#     name = "notes"
#     type = "STRING"
#   }

#   table_type         = "MANAGED"
#   data_source_format = "DELTA"
# }

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
  column {
    name    = "last_processed_timestamp"
    type    = "TIMESTAMP"
    comment = "Timestamp of the last DLT pipeline run"
  }

  table_type         = "MANAGED"
  data_source_format = "DELTA"
}

# Raw Kinesis data landing table
resource "databricks_sql_table" "raw_kinesis_data" {
  provider     = databricks.workspace
  catalog_name = var.catalog_name
  schema_name  = var.schema_name
  name         = "raw_kinesis_data"
  comment      = "Landing zone for raw IoT device data from AWS Kinesis streams"

  lifecycle {
    ignore_changes = [
      column
    ]
  }

  column {
    name    = "data"
    type    = "BINARY"
    comment = "Raw binary data from Kinesis"
  }
  column {
    name    = "sequenceNumber"
    type    = "STRING"
    comment = "Original Kinesis sequence number"
  }
  column {
    name    = "partitionKey"
    type    = "STRING"
    comment = "Kinesis partition key"
  }
  column {
    name    = "approximateArrivalTimestamp"
    type    = "TIMESTAMP"
    comment = "Timestamp when record arrived in Kinesis"
  }
  column {
    name    = "shardId"
    type    = "STRING"
    comment = "Kinesis shard ID"
  }
  column {
    name    = "raw_payload"
    type    = "STRING"
    comment = "Raw payload converted to string format"
  }
  column {
    name    = "parsed_data"
    type    = "STRUCT<topic:STRING, device_id:STRING, timestamp:TIMESTAMP, experiment_id:STRING, sensor_type:STRING, reading_value:DOUBLE, reading_unit:STRING, device_type:STRING, device_version:STRING, device_name:STRING, device_battery:DOUBLE, device_firmware:STRING, measurement_type:STRING, protocol:STRING, latitude:DOUBLE, longitude:DOUBLE, plant_metadata:STRUCT<plant_id:STRING, plant_name:STRING, plant_genotype:STRING, plant_location:STRING, notes:STRING>, SPAD:DOUBLE, created_at:TIMESTAMP, md5_protocol:STRING, md5_measurement:STRING>"
    comment = "Parsed JSON data structure"
  }
  column {
    name    = "ingestion_timestamp"
    type    = "TIMESTAMP"
    comment = "Timestamp when the record was ingested into Delta"
  }
  column {
    name    = "ingest_date"
    type    = "DATE"
    comment = "Date partition extracted from ingestion timestamp"
  }
  column {
    name    = "kinesis_sequence_number"
    type    = "STRING"
    comment = "Kinesis sequence number (duplicated for clarity)"
  }
  column {
    name    = "kinesis_shard_id"
    type    = "STRING"
    comment = "Kinesis shard ID (duplicated for clarity)"
  }
  column {
    name    = "kinesis_arrival_time"
    type    = "TIMESTAMP"
    comment = "Arrival timestamp in Kinesis (duplicated for clarity)"
  }
  column {
    name    = "experiment_id"
    type    = "STRING"
    comment = "Extracted experiment ID from topic or metadata"
  }
  column {
    name    = "stream"
    type    = "STRING"
    comment = "The name of the Kinesis stream source"
  }

  table_type         = "MANAGED"
  data_source_format = "DELTA"

  partitions = ["ingest_date"]
}


variable "job_name" {
  description = "Name of the Databricks job"
  type        = string
  default     = "Sensor Data Ingestion Pipeline"
}

variable "job_description" {
  description = "Description of the Databricks job"
  type        = string
  default     = "Pipeline to ingest sensor data from Kinesis into Databricks"
}

variable "stream_config" {
  description = "Stream configuration details"
  type = object({
    kinesis_stream_name = string
    aws_region          = string
    kinesis_endpoint    = optional(string)
  })
}

variable "catalog_config" {
  description = "Unity Catalog configuration"
  type = object({
    catalog_name   = string
    central_schema = string
  })
  default = {
    catalog_name   = "open_jii_dev"
    central_schema = "centrum"
  }
}

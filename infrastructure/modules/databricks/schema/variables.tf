variable "catalog_name" {
  description = "The Databricks catalog where the schema will be created"
  type        = string
  default     = "open_jii"
}

variable "schema_name" {
  description = "The name of the schema to provision"
  type        = string
  default     = "central"
}

variable "schema_comment" {
  description = "A comment describing the purpose of this schema"
  type        = string
  default     = "Central schema holding the experiments table and other shared resources"
}

variable "create_medallion_tables" {
  description = "Whether to create the medallion architecture tables (raw_data, clean_data, analytics_data)"
  type        = bool
  default     = true
}

variable "create_metadata_tables" {
  description = "Whether to create additional metadata tables (sensor_metadata, plant_metadata)"
  type        = bool
  default     = true
}

variable "catalog_name" {
  description = "The Databricks catalog where the experiment schema will be created"
  type        = string
  default     = "open_jii"
}

variable "schema_name" {
  description = "The name of the experiment schema to provision"
  type        = string
}

variable "schema_comment" {
  description = "A comment describing the purpose of this experiment schema"
  type        = string
  default     = "Experiment-specific schema following the medallion architecture"
}

variable "central_schema_name" {
  description = "The name of the central schema containing shared tables"
  type        = string
  default     = "centrum"
}

variable "experiment_id" {
  description = "The ID of the experiment associated with this schema"
  type        = string
  default     = ""
}

variable "create_medallion_tables" {
  description = "Whether to create the medallion architecture tables (raw_data, clean_data, analytics_data)"
  type        = bool
  default     = true
}

variable "create_metadata_tables" {
  description = "Whether to create additional metadata tables (sensor_metadata, plant_metadata, experiment_metadata)"
  type        = bool
  default     = true
}


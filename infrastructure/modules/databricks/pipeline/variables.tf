variable "pipeline_name" {
  description = "The name of the Databricks pipeline. This should be descriptive and reflect the pipeline's purpose in the data engineering workflow."
  type        = string
  default     = "sensor_data_medallion_pipeline"

  validation {
    condition     = length(var.pipeline_name) >= 3 && length(var.pipeline_name) <= 100
    error_message = "Pipeline name should be between 3 and 100 characters."
  }
}

variable "notebook_path" {
  description = "The full path to the notebook that contains the pipeline's transformation logic. This notebook should implement the medallion architecture steps."
  type        = string
  default     = "./notebooks/ingest_pipeline"
}

variable "target_schema_name" {
  description = "The schema name where pipeline output tables will be created."
  type        = string
  default     = "sensor_data"
}

variable "edition" {
  description = "The edition/tier of the pipeline. For development environments, use 'basic' to minimize costs."
  type        = string
  default     = "advanced"
}

variable "cluster_autoscale_min_workers" {
  description = "Minimum number of workers for the cluster. For development, keep this at minimum."
  type        = number
  default     = 0 # Single-node cluster for development
}

variable "cluster_autoscale_max_workers" {
  description = "Maximum number of workers the cluster can scale up to. Limit for development environments."
  type        = number
  default     = 1 # Minimal scaling for development
}

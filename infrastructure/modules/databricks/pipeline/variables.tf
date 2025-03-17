variable "name" {
  description = "Name of the pipeline"
  type        = string
}

variable "schema_name" {
  description = "Schema name for the pipeline output"
  type        = string
}

variable "description" {
  description = "Description of the pipeline purpose"
  type        = string
  default     = "Data pipeline managed by Terraform"
}

variable "notebook_paths" {
  description = "List of notebook paths to include in the pipeline"
  type        = list(string)
}

variable "configuration" {
  description = "Pipeline configuration parameters"
  type        = map(string)
  default     = {}
}

variable "development_mode" {
  description = "Whether to run the pipeline in development mode"
  type        = bool
  default     = true
}

variable "continuous_mode" {
  description = "Whether the pipeline should run continuously (streaming) or on a trigger"
  type        = bool
  default     = false
}

variable "node_type_id" {
  description = "The node type ID to use for the pipeline cluster"
  type        = string
  default     = null
}

variable "autoscale" {
  description = "Whether to enable autoscaling for the pipeline cluster"
  type        = bool
  default     = false
}

variable "min_workers" {
  description = "Minimum number of workers when autoscaling is enabled"
  type        = number
  default     = 1
}

variable "max_workers" {
  description = "Maximum number of workers when autoscaling is enabled"
  type        = number
  default     = 4
}

variable "num_workers" {
  description = "Fixed number of workers when autoscaling is disabled"
  type        = number
  default     = 1
}

variable "log_level" {
  description = "Log level for the pipeline"
  type        = string
  default     = "INFO"
  validation {
    condition     = contains(["INFO", "WARN", "ERROR", "DEBUG"], var.log_level)
    error_message = "Log level must be one of: INFO, WARN, ERROR, DEBUG."
  }
}

variable "catalog_name" {
  description = "Name of the Databricks catalog to use for the pipeline"
  type        = string
}

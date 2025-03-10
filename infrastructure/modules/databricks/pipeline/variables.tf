variable "name" {
  description = "Name of the pipeline"
  type        = string
}

variable "schema_name" {
  description = "Schema name for the pipeline output"
  type        = string
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

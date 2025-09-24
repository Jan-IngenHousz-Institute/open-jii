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

variable "serverless" {
  description = "Whether to use serverless compute for the pipeline. If true, cluster block is omitted."
  type        = bool
  default     = false
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

variable "run_as" {
  description = "Configuration for the user or service principal to run the pipeline as"
  type = object({
    service_principal_name = optional(string)
    user_name             = optional(string)
  })
  default = null
  
  validation {
    condition = var.run_as == null || (
      (var.run_as.service_principal_name != null && var.run_as.user_name == null) ||
      (var.run_as.service_principal_name == null && var.run_as.user_name != null)
    )
    error_message = "Either service_principal_name or user_name must be specified, but not both."
  }
}

variable "permissions" {
  description = "List of permissions to grant on the pipeline. Each object should have principal_application_id and permission_level."
  type = list(object({
    principal_application_id = string
    permission_level         = string
  }))
  default = []
  
  validation {
    condition = alltrue([
      for p in var.permissions : contains(["CAN_VIEW", "CAN_RUN", "CAN_MANAGE", "IS_OWNER"], p.permission_level)
    ])
    error_message = "permission_level must be one of: CAN_VIEW, CAN_RUN, CAN_MANAGE, IS_OWNER"
  }
}

variable "name" {
  description = "Job name"
  type        = string
}

variable "description" {
  description = "Job description"
  type        = string
  default     = ""
}

variable "schedule" {
  description = "Cron schedule expression (UTC timezone). Set to null for manual triggering only."
  type        = string
  default     = null
}

variable "continuous" {
  description = "Whether this is a continuous job"
  type        = bool
  default     = false
}

variable "tasks" {
  description = "Tasks to run in the job"
  type = list(object({
    key          = string
    task_type    = string
    compute_type = string

    # For notebook tasks
    notebook_path = optional(string)
    parameters    = optional(map(string), {})

    # For pipeline tasks
    pipeline_id = optional(string)

    # For existing cluster
    cluster_id = optional(string)

    # For new cluster
    node_type_id = optional(string)
    num_workers  = optional(number, 1)
    single_node  = optional(bool, false)

    # Spark configurations for this task
    spark_conf = optional(map(string), {})

    # Dependencies
    depends_on = optional(string)
  }))
  default = []
}

variable "max_concurrent_runs" {
  description = "Maximum number of concurrent runs"
  type        = number
  default     = 1
}

variable "use_serverless" {
  description = "Whether to use serverless compute for all tasks (no cluster configuration)"
  type        = bool
  default     = false
}


variable "serverless_performance_target" {
  description = "The performance mode for serverless jobs. PERFORMANCE_OPTIMIZED prioritizes fast startup and execution, STANDARD is more cost-efficient."
  type        = string
  default     = "PERFORMANCE_OPTIMIZED"
  validation {
    condition     = contains(["PERFORMANCE_OPTIMIZED", "STANDARD"], var.serverless_performance_target)
    error_message = "serverless_performance_target must be one of: PERFORMANCE_OPTIMIZED, STANDARD"
  }
}

variable "task_retry_config" {
  description = "Task retry configuration"
  type = object({
    retries                   = optional(number, 3)
    min_retry_interval_millis = optional(number, 60000)
    retry_on_timeout          = optional(bool, true)
  })
  default = {}
}

variable "global_spark_conf" {
  description = "Global Spark configurations to apply to all tasks"
  type        = map(string)
  default     = {}
}

variable "permissions" {
  description = "List of permissions to grant on the job. Each object should have principal_application_id and principal_can_manage."
  type = list(object({
    principal_application_id = string
    principal_can_manage     = bool
  }))
  default = []
}

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

variable "spark_conf" {
  description = "Global Spark configurations to apply to all tasks (Only applicable if not using serverless compute)."
  type        = map(string)
  default     = {}
}

variable "permissions" {
  description = "List of permissions to grant on the job. Each object should have principal_application_id and permission_level."
  type = list(object({
    principal_application_id = string
    permission_level         = string
  }))
  default = []
  validation {
    condition = alltrue([
      for p in var.permissions : contains(["CAN_VIEW", "CAN_MANAGE_RUN", "IS_OWNER", "CAN_MANAGE"], p.permission_level)
    ])
    error_message = "permission_level must be one of: CAN_VIEW, CAN_MANAGE_RUN, IS_OWNER, CAN_MANAGE"
  }
}

variable "run_as" {
  description = "Run as configuration for the job. Specify either service_principal_name or user_name."
  type = object({
    service_principal_name = optional(string)
    user_name              = optional(string)
  })
  default = null
}

variable "queue" {
  description = "Queue configuration for the job. Allows configuring job queueing behavior."
  type = object({
    enabled = bool
  })
  default = null
}

variable "webhook_notifications" {
  description = "Webhook notifications for job events (Slack, etc.)"
  type = object({
    on_start                               = optional(list(string))
    on_success                             = optional(list(string))
    on_failure                             = optional(list(string))
    on_duration_warning_threshold_exceeded = optional(list(string))
    on_streaming_backlog_exceeded          = optional(list(string))
  })
  default = null
}

variable "email_notifications" {
  description = "Email addresses to notify on job events"
  type = object({
    on_start                               = optional(list(string), [])
    on_success                             = optional(list(string), [])
    on_failure                             = optional(list(string), [])
    on_duration_warning_threshold_exceeded = optional(list(string), [])
    on_streaming_backlog_exceeded          = optional(list(string), [])
    no_alert_for_skipped_runs              = optional(bool, false)
  })
  default = null
}

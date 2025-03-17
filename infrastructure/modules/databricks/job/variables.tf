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

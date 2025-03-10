variable "name" {
  description = "Name of the job"
  type        = string
}

variable "description" {
  description = "Description of the job"
  type        = string
  default     = "Pipeline orchestration job"
}

variable "pipeline_tasks" {
  description = "DLT pipeline tasks to run"
  type = list(object({
    name        = string
    pipeline_id = string
    depends_on  = optional(string)
  }))
  default = []
}

variable "notebook_tasks" {
  description = "Notebook tasks to run"
  type = list(object({
    name          = string
    notebook_path = string
    parameters    = optional(map(string), {})
    depends_on    = optional(string)
  }))
  default = []
}

variable "schedule" {
  description = "Cron schedule expression (optional)"
  type        = string
  default     = null
}

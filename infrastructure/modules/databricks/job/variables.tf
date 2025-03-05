variable "job_name" {
  description = "The name of the Databricks job. This name appears in the Databricks UI and should be descriptive of the job's purpose."
  type        = string
  default     = "centrum_distribute_job"
}

variable "num_workers" {
  description = "The number of worker nodes for the cluster. For development environments, a small cluster or single-node setup is recommended."
  type        = number
  default     = 0 # Single-node cluster (no workers) for development
}

variable "notebook_path" {
  description = "The path to the notebook that will be executed by this job. Must be a full path including workspace directory (e.g., '/Users/username/path/to/notebook')."
  type        = string
  default     = "./notebooks/transform_pipeline"
}

variable "schedule_quartz_expression" {
  description = "A quartz cron expression that defines the job schedule. For development, consider using a less frequent schedule or manual triggers."
  type        = string
  default     = "0 0 0/8 * * ?" # Once every 8 hours (runs at 00:00, 08:00, and 16:00)
}

variable "timeout_seconds" {
  description = "The timeout for the job in seconds. Lower values are suitable for development environments."
  type        = number
  default     = 1800 # 30 minutes, reasonable for development jobs
}

variable "ingest_pipeline_id" {
  description = "The ID of the Delta Live Tables pipeline that will be triggered by this job. This pipeline should be defined in the same workspace."
  type        = string
}

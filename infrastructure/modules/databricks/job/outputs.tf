output "job_id" {
  description = "The unique identifier of the created Databricks job. This ID can be used to reference the job in other resources or for monitoring purposes."
  value       = databricks_job.this.id
}

output "job_url" {
  description = "The URL to access the job in the Databricks UI. Useful for documentation and quick access."
  value       = databricks_job.this.url
}

output "created_time" {
  description = "The timestamp when the job was created."
  value       = databricks_job.this.created_time
}

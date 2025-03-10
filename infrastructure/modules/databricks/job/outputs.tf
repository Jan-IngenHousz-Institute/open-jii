output "job_id" {
  description = "ID of the created job"
  value       = databricks_job.this.id
}

output "job_url" {
  description = "URL of the job in the Databricks workspace"
  value       = databricks_job.this.url
}

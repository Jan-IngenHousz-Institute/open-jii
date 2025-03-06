output "job_id" {
  description = "ID of the created Databricks job"
  value       = databricks_job.ingest_pipeline.id
}

output "job_url" {
  description = "URL to access the job in the Databricks workspace"
  value       = databricks_job.ingest_pipeline.url
}

output "pipeline_id" {
  description = "The unique identifier of the created Databricks pipeline. This ID can be used in other resources or for monitoring."
  value       = databricks_pipeline.this.id
}

output "pipeline_name" {
  description = "The name of the created Databricks pipeline."
  value       = databricks_pipeline.this.name
}

output "target_schema" {
  description = "The database schema where pipeline output tables are created."
  value       = databricks_pipeline.this.target
}

output "pipeline_url" {
  description = "The URL to access the pipeline in the Databricks UI."
  value       = "https://<workspace-url>/#pipeline/${databricks_pipeline.this.id}"
}

output "pipeline_id" {
  description = "ID of the created pipeline"
  value       = databricks_pipeline.this.id
}

output "pipeline_url" {
  description = "URL of the pipeline in the Databricks workspace"
  value       = databricks_pipeline.this.url
}

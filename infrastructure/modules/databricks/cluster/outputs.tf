output "cluster_id" {
  description = "The ID of the created Databricks cluster"
  value       = databricks_cluster.this.id
}

output "cluster_url" {
  description = "The URL to access the cluster in the Databricks workspace"
  value       = databricks_cluster.this.url
}

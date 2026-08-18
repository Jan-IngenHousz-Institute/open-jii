output "share_id" {
  description = "The unique identifier of the created Delta Sharing share."
  value       = databricks_share.this.id
}

output "share_name" {
  description = "The name of the created Delta Sharing share."
  value       = databricks_share.this.name
}


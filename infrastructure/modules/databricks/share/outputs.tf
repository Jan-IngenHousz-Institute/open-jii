output "share_id" {
  description = "The unique identifier of the created Delta Sharing share."
  value       = databricks_share.this.id
}

output "share_name" {
  description = "The name of the created Delta Sharing share."
  value       = databricks_share.this.name
}

output "share_url" {
  description = "The URL endpoint for accessing this share via Delta Sharing protocol."
  value       = "The share URL will be available after a recipient is created and granted access"
}

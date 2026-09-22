output "grant_id" {
  description = "The unique identifier of the grant."
  value       = databricks_grants.this.id
}

output "share_name" {
  description = "The name of the share for which access was granted."
  value       = databricks_grants.this.share
}

output "recipient_name" {
  description = "The name of the recipient who was granted access."
  value       = var.recipient_name
}

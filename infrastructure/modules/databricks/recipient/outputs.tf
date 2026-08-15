output "recipient_id" {
  description = "The unique identifier of the created recipient."
  value       = databricks_recipient.this.id
}

output "recipient_name" {
  description = "The name of the created recipient."
  value       = databricks_recipient.this.name
}

output "activation_url" {
  description = "The URL that the recipient can use to download their credential file."
  value       = databricks_recipient.this.activation_url
  sensitive   = true
}

output "tokens" {
  description = "The bearer token(s) for the recipient. Used for authentication when accessing shared data."
  value       = try(databricks_recipient.this.tokens, [])
  sensitive   = true
}

output "authentication_type" {
  description = "The authentication type configured for this recipient."
  value       = databricks_recipient.this.authentication_type
}

output "recipient_metastore_id" {
  description = "The metastore ID where the recipient is registered."
  value       = databricks_recipient.this.metastore_id
}

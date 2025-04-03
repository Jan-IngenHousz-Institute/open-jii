output "policy_id" {
  description = "The ID of the Databricks bucket policy"
  value       = data.databricks_aws_bucket_policy.this.id
}

output "policy_json" {
  description = "The Databricks bucket policy JSON document"
  value       = data.databricks_aws_bucket_policy.this.json
}

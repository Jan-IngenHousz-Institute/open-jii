output "workspace_id" {
  description = "Databricks Workspace ID"
  value       = databricks_mws_workspaces.this.workspace_id
}

output "workspace_url" {
  description = "Databricks Workspace URL"
  value       = databricks_mws_workspaces.this.workspace_url
}

output "role_arn" {
  description = "ARN of the cross-account IAM role"
  value       = aws_iam_role.cross_account_role.arn
}

output "kinesis_credential_id" {
  description = "ID of the Kinesis access credential created in the workspace module"
  value       = databricks_credential.kinesis.id
}

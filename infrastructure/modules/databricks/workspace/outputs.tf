output "workspace_id" {
  description = "Databricks Workspace ID"
  value       = databricks_mws_workspaces.this.workspace_id
  # sensitive   = true
}

output "workspace_url" {
  description = "Databricks Workspace URL"
  value       = databricks_mws_workspaces.this.workspace_url
  sensitive   = true
}

output "role_arn" {
  description = "ARN of the cross-account IAM role"
  value       = aws_iam_role.cross_account_role.arn
  sensitive   = true
}

output "kinesis_credential_id" {
  description = "ID of the Kinesis access credential created in the workspace module"
  value       = var.kinesis_role_arn != null && var.kinesis_role_name != null ? databricks_credential.kinesis[0].id : null
  sensitive   = true
}

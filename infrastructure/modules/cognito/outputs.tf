output "identity_pool_id" {
  description = "The Cognito Identity Pool ID"
  value       = aws_cognito_identity_pool.this.id
}

output "identity_pool_arn" {
  description = "The ARN of the Cognito Identity Pool"
  value       = aws_cognito_identity_pool.this.arn
}

output "authenticated_role_arn" {
  description = "ARN of the authenticated IAM role for developer-authenticated identities"
  value       = aws_iam_role.auth.arn
}

output "developer_provider_name" {
  description = "Developer provider name for API calls (environment-specific)"
  value       = local.developer_provider_name_full
}

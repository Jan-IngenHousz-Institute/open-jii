output "identity_pool_id" {
  description = "The Cognito Identity Pool ID"
  value       = aws_cognito_identity_pool.this.id
}

output "unauthenticated_role_arn" {
  description = "ARN of the unauthenticated IAM role"
  value       = aws_iam_role.unauth.arn
}
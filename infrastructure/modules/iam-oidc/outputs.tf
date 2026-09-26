output "oidc_provider_arn" {
  description = "ARN of the created OIDC provider."
  value       = aws_iam_openid_connect_provider.github.arn
}

output "role_arn" {
  description = "ARN of the IAM role that can be assumed via OIDC."
  value       = aws_iam_role.oidc_role.arn
}

output "plan_role_arn" {
  description = "ARN of the read-only plan role, or null when none is created."
  value       = one(aws_iam_role.plan_role[*].arn)
}

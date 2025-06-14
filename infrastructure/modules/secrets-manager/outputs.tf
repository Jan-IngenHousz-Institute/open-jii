output "secret_arn" {
  description = "ARN of the secret"
  value       = aws_secretsmanager_secret.secret.arn
  sensitive   = true
}

output "secret_id" {
  description = "ID of the secret"
  value       = aws_secretsmanager_secret.secret.id
  sensitive   = true
}

output "secret_version_id" {
  description = "Version ID of the secret version"
  value       = aws_secretsmanager_secret_version.secret_version.version_id
  sensitive   = true
}

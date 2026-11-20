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

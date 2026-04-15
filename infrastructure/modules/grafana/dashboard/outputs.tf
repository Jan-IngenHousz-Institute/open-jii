output "grafana_db_credentials_secret_arn" {
  value       = aws_secretsmanager_secret.grafana_db_credentials.arn
  description = "ARN of the Secrets Manager secret containing the Grafana read-only DB credentials. Pass to the migration runner ECS task as GRAFANA_DB_CREDENTIALS."
  sensitive   = true
}


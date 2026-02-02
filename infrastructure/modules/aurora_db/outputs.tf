output "cluster_endpoint" {
  value       = aws_rds_cluster.rds_cluster_aurora.endpoint
  description = "Aurora cluster primary endpoint for write operations"
}

output "reader_endpoint" {
  value       = aws_rds_cluster.rds_cluster_aurora.reader_endpoint
  description = "Aurora cluster reader endpoint for read-only operations"
}

output "cluster_port" {
  value       = aws_rds_cluster.rds_cluster_aurora.port
  description = "Aurora cluster port number"
}

output "database_name" {
  value       = aws_rds_cluster.rds_cluster_aurora.database_name
  description = "Name of the default database"
}

output "cluster_arn" {
  value       = aws_rds_cluster.rds_cluster_aurora.arn
  description = "Aurora cluster ARN for IAM policies and cross-service references"
}

output "performance_insights_kms_key_id" {
  value       = aws_kms_key.performance_insights_key.key_id
  description = "KMS key ID used for Performance Insights encryption"
}

output "master_user_secret_arn" {
  value       = aws_rds_cluster.rds_cluster_aurora.master_user_secret[0].secret_arn
  description = "The ARN of the secret in AWS Secrets Manager containing master credentials"
  sensitive   = true
}

output "writer_credentials_secret_arn" {
  value       = aws_secretsmanager_secret.writer_credentials.arn
  description = "The ARN of the secret in AWS Secrets Manager containing writer user credentials"
  sensitive   = true
}

output "reader_credentials_secret_arn" {
  value       = aws_secretsmanager_secret.reader_credentials.arn
  description = "The ARN of the secret in AWS Secrets Manager containing reader user credentials"
  sensitive   = true
}

output "writer_username" {
  value       = "openjii_writer"
  description = "Username for the writer application user"
}

output "reader_username" {
  value       = "openjii_reader"
  description = "Username for the reader application user"
}

output "primary_vault_arn" {
  description = "ARN of the primary AWS Backup vault"
  value       = aws_backup_vault.primary.arn
}

output "primary_vault_name" {
  description = "Name of the primary AWS Backup vault"
  value       = aws_backup_vault.primary.name
}

output "dr_vault_arn" {
  description = "ARN of the DR AWS Backup vault in the DR region"
  value       = aws_backup_vault.dr.arn
}

output "backup_plan_id" {
  description = "ID of the backup plan"
  value       = aws_backup_plan.main.id
}

output "backup_role_arn" {
  description = "ARN of the IAM role used by AWS Backup"
  value       = aws_iam_role.backup_role.arn
}

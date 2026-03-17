variable "vault_name" {
  description = "Name of the primary AWS Backup vault"
  type        = string
  default     = "open-jii-backup-vault"
}

variable "environment" {
  description = "Environment name (e.g., prod, dev)"
  type        = string
}

variable "backup_retention_days" {
  description = "Number of days to retain backups in the primary vault"
  type        = number
  default     = 14
}

variable "dr_backup_retention_days" {
  description = "Number of days to retain backup copies in the DR vault"
  type        = number
  default     = 30
}

variable "aurora_cluster_arns" {
  description = "List of Aurora cluster ARNs to include in the backup plan"
  type        = list(string)
  default     = []
}

variable "dynamodb_table_arns" {
  description = "List of DynamoDB table ARNs to include in the backup plan"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to all backup resources"
  type        = map(string)
  default     = {}
}

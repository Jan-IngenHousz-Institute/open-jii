# Required variables
variable "cluster_identifier" {
  description = "Unique identifier for the Aurora cluster"
  type        = string
}

variable "database_name" {
  description = "Name of the database"
  type        = string
}

variable "master_username" {
  description = "Username for the database master account"
  type        = string
}

variable "vpc_security_group_ids" {
  description = "List of security group IDs associated with the database"
  type        = list(string)
}

variable "db_subnet_group_name" {
  description = "Name of the DB subnet group"
  type        = string
}

# Configurable variables with sensible defaults
variable "max_capacity" {
  description = "Maximum capacity for Aurora Serverless v2 scaling (0.5-128 ACU)"
  type        = number
  default     = 1.0
}

variable "min_capacity" {
  description = "Minimum capacity for Aurora Serverless v2 scaling (0.5-128 ACU)"
  type        = number
  default     = 0
}

variable "seconds_until_auto_pause" {
  description = "Seconds before the cluster auto-pauses (300-86400 seconds, or 5 minutes to 24 hours)"
  type        = number
  default     = 1800 # 30 minutes
}

variable "enable_enhanced_monitoring" {
  description = "Enable RDS Enhanced Monitoring (additional cost of ~$2.50/month per instance)"
  type        = bool
  default     = false # Disabled by default for cost optimization
}

# Optional cost optimization variables
variable "backup_retention_period" {
  description = "Number of days to retain automated backups (1-35 days)"
  type        = number
  default     = 7
}

variable "performance_insights_retention_period" {
  description = "Performance Insights retention period in days (7 days free, 1-24 months paid)"
  type        = number
  default     = 7 # Free tier
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot on deletion (set to true for dev environments to save costs)"
  type        = bool
  default     = false
}

variable "enable_kms_key_rotation" {
  description = "Enable automatic rotation for KMS keys"
  type        = bool
  default     = true
}

variable "kms_key_deletion_window" {
  description = "Number of days to retain KMS keys before deletion (7-30 days)"
  type        = number
  default     = 7

  validation {
    condition     = var.kms_key_deletion_window >= 7 && var.kms_key_deletion_window <= 30
    error_message = "KMS key deletion window must be between 7 and 30 days."
  }
}

variable "environment" {
  description = "Environment name (e.g., dev, prod, staging)"
  type        = string
}

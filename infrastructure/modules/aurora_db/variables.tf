variable "cluster_identifier" {
  description = "Unique identifier for the Aurora cluster"
  type        = string
  #default     = "mock-aurora-db"
}

variable "engine_mode" {
  description = "Defines whether the Aurora cluster is provisioned or serverless"
  type        = string
  default     = "provisioned"
}

variable "engine" {
  description = "Database engine used in the cluster"
  type        = string
  default     = "aurora-postgresql"
}

variable "engine_version" {
  description = "Version of the database engine"
  type        = string
  default     = "13.6"
}

variable "database_name" {
  description = "Name of the database"
  type        = string
  #default     = "mockdb"
}

variable "manage_master_user_password" {
  description = "Determines whether Terraform should manage the master password"
  type        = bool
  default     = true
}

variable "master_username" {
  description = "Username for the database master account"
  type        = string
  #default     = "test"
}

variable "storage_encrypted" {
  description = "Whether the storage for the database is encrypted"
  type        = bool
  default     = true
}

variable "vpc_security_group_ids" {
  description = "List of security group IDs associated with the database"
  type        = list(string)
}

variable "db_subnet_group_name" {
  description = "Name of the DB subnet group"
  type        = string
}

variable "preferred_backup_window" {
  description = "Time frame for daily backups"
  type        = string
  default     = "00:00-02:00"
}

variable "preferred_maintenance_window" {
  description = "Time frame for scheduled maintenance"
  type        = string
  default     = "sun:03:00-sun:07:00"
}

variable "max_capacity" {
  description = "Maximum capacity for Aurora Serverless v2 scaling"
  type        = number
  default     = 2.0
}

variable "min_capacity" {
  description = "Minimum capacity for Aurora Serverless v2 scaling"
  type        = number
  default     = 0.0
}

variable "seconds_until_auto_pause" {
  description = "Seconds before the cluster auto-pauses"
  type        = number
  default     = 3600
}

variable "instance_class" {
  description = "Instance type for the Aurora cluster"
  type        = string
  default     = "db.serverless"
}

variable "iam_database_authentication_enabled" {
  description = "IAM authentication for Aurora DB"
  type        = bool
  default     = true
}
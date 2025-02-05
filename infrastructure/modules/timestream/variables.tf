variable "database_name" {
  description = "Name of the Timestream database"
  type        = string
}

variable "table_name" {
  description = "Name of the Timestream table"
  type        = string
}

variable "memory_retention_hours" {
  description = "Retention period in hours for the in-memory store"
  type        = number
  default     = 24
}

variable "magnetic_retention_days" {
  description = "Retention period in days for the magnetic store"
  type        = number
  default     = 7
}
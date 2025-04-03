variable "table_name" {
  description = "The name of the DynamoDB table to create"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for the DynamoDB table"
  type        = bool
  default     = false
}

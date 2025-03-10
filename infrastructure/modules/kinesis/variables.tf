variable "stream_name" {
  description = "Name of the Kinesis Data Stream"
  type        = string
}

variable "shard_count" {
  description = "Number of shards for the stream"
  type        = number
  default     = 1
}

variable "retention_period_hours" {
  description = "Data retention period in hours"
  type        = number
  default     = 24
}

variable "role_name" {
  description = "Name of the IAM role for Unity Catalog Kinesis access"
  type        = string
  default     = "unity-catalog-kinesis-role"
}

variable "policy_name" {
  description = "Name of the IAM policy for Kinesis access"
  type        = string
  default     = "unity-catalog-kinesis-policy"
}

variable "databricks_unity_catalog_role_arn" {
  description = "ARN of the Databricks Unity Catalog role"
  type        = string
  default     = "arn:aws:iam::414351767826:role/unity-catalog-prod-UCMasterRole-14S5ZJVKOTYTL"
}

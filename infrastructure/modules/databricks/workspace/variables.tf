variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "databricks_account_id" {
  description = "Databricks Account ID"
  type        = string
}

variable "bucket_name" {
  description = "The name of the root S3 bucket"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnets" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "sg_id" {
  description = "Security group ID for Databricks clusters"
  type        = string
}

variable "kinesis_role_name" {
  description = "Name of the IAM role for Kinesis access"
  type        = string
  default     = "unity-catalog-kinesis-role"
}

variable "kinesis_role_arn" {
  description = "ARN of the IAM role for Kinesis access"
  type        = string
}

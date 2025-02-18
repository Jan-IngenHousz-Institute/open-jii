variable "databricks_account_id" {
  description = "Databricks Account ID"
  type        = string
}

variable "prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
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

variable "s3_bucket" {
  description = "S3 bucket name for storage configuration"
  type        = string
}

variable "iam_role_arn" {
  description = "IAM role ARN used for credentials"
  type        = string
}

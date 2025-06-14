# OpenNext Main Module Variables

variable "project_name" {
  description = "Name of the project (used for resource naming)"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "region" {
  description = "AWS region for resources"
  type        = string
  default     = "eu-central-1"
}

# Domain Configuration
variable "domain_name" {
  description = "Custom domain name for the application (optional)"
  type        = string
  default     = ""
}

variable "subdomain" {
  description = "Subdomain for the application (optional)"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS (required if using custom domain)"
  type        = string
  default     = ""
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone ID for DNS records (optional)"
  type        = string
  default     = ""
}

# S3 Configuration
variable "assets_bucket_name" {
  description = "Name for the S3 bucket storing static assets (optional, auto-generated if not provided)"
  type        = string
  default     = ""
}

variable "cache_bucket_name" {
  description = "Name for the S3 bucket storing cache data (optional, auto-generated if not provided)"
  type        = string
  default     = ""
}

variable "enable_versioning" {
  description = "Enable S3 bucket versioning"
  type        = bool
  default     = true
}

variable "enable_logging" {
  description = "Enable S3 access logging"
  type        = bool
  default     = true
}

# Lambda Configuration
variable "server_function_name" {
  description = "Name for the server Lambda function (optional, auto-generated if not provided)"
  type        = string
  default     = ""
}

variable "image_function_name" {
  description = "Name for the image optimization Lambda function (optional, auto-generated if not provided)"
  type        = string
  default     = ""
}

variable "revalidate_function_name" {
  description = "Name for the revalidation Lambda function (optional, auto-generated if not provided)"
  type        = string
  default     = ""
}

variable "warmer_function_name" {
  description = "Name for the warmer Lambda function (optional, auto-generated if not provided)"
  type        = string
  default     = ""
}

variable "lambda_runtime" {
  description = "Lambda runtime for all functions"
  type        = string
  default     = "nodejs22.x"
}

variable "lambda_architecture" {
  description = "Lambda architecture (x86_64 or arm64)"
  type        = string
  default     = "arm64"
}

variable "server_memory_size" {
  description = "Memory size for server Lambda function (MB)"
  type        = number
  default     = 1024
}

variable "server_timeout" {
  description = "Timeout for server Lambda function (seconds)"
  type        = number
  default     = 30
}

variable "image_memory_size" {
  description = "Memory size for image optimization Lambda function (MB)"
  type        = number
  default     = 1536
}

variable "image_timeout" {
  description = "Timeout for image optimization Lambda function (seconds)"
  type        = number
  default     = 30
}

variable "revalidate_memory_size" {
  description = "Memory size for revalidation Lambda function (MB)"
  type        = number
  default     = 512
}

variable "revalidate_timeout" {
  description = "Timeout for revalidation Lambda function (seconds)"
  type        = number
  default     = 30
}

variable "warmer_memory_size" {
  description = "Memory size for warmer Lambda function (MB)"
  type        = number
  default     = 512
}

variable "warmer_timeout" {
  description = "Timeout for warmer Lambda function (seconds)"
  type        = number
  default     = 30
}

variable "enable_lambda_warming" {
  description = "Enable Lambda warming with EventBridge"
  type        = bool
  default     = true
}

# DynamoDB Configuration
variable "dynamodb_table_name" {
  description = "Name for the DynamoDB table (optional, auto-generated if not provided)"
  type        = string
  default     = ""
}

variable "dynamodb_billing_mode" {
  description = "DynamoDB billing mode (PAY_PER_REQUEST or PROVISIONED)"
  type        = string
  default     = "PAY_PER_REQUEST"
}

variable "enable_point_in_time_recovery" {
  description = "Enable DynamoDB point-in-time recovery"
  type        = bool
  default     = true
}

# SQS Configuration
variable "revalidation_queue_name" {
  description = "Name for the SQS revalidation queue (optional, auto-generated if not provided)"
  type        = string
  default     = ""
}

variable "visibility_timeout_seconds" {
  description = "SQS message visibility timeout (seconds)"
  type        = number
  default     = 30
}

variable "message_retention_seconds" {
  description = "SQS message retention period (seconds)"
  type        = number
  default     = 1209600 # 14 days
}

variable "enable_dlq" {
  description = "Enable dead letter queue for SQS"
  type        = bool
  default     = true
}

variable "max_receive_count" {
  description = "Maximum receive count before message goes to DLQ"
  type        = number
  default     = 3
}

# CloudFront Configuration
variable "price_class" {
  description = "CloudFront price class (PriceClass_All, PriceClass_200, PriceClass_100)"
  type        = string
  default     = "PriceClass_100"
}

variable "enable_compression" {
  description = "Enable CloudFront compression"
  type        = bool
  default     = true
}

variable "minimum_protocol_version" {
  description = "Minimum TLS protocol version"
  type        = string
  default     = "TLSv1.2_2021"
}

variable "enable_ipv6" {
  description = "Enable IPv6 for CloudFront distribution"
  type        = bool
  default     = true
}

# Monitoring and Logging
variable "enable_cloudwatch_logs" {
  description = "Enable CloudWatch logs for Lambda functions"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention period (days)"
  type        = number
  default     = 14
}

variable "enable_xray_tracing" {
  description = "Enable X-Ray tracing for Lambda functions"
  type        = bool
  default     = false
}

# Tags
variable "tags" {
  description = "Additional tags for all resources"
  type        = map(string)
  default     = {}
}

# VPC Configuration (for server Lambda database access)
variable "enable_server_vpc" {
  description = "Whether to deploy the server Lambda function within a VPC for database access"
  type        = bool
  default     = false
}

variable "server_subnet_ids" {
  description = "List of private subnet IDs where the server Lambda function should be placed (required if enable_server_vpc is true)"
  type        = list(string)
  default     = []
}

variable "server_lambda_security_group_id" {
  description = "ID of the security group for the server Lambda function to access Aurora (required if enable_server_vpc is true)"
  type        = string
}

variable "db_environment_variables" {
  description = "Database environment variables for the server Lambda function"
  type        = map(string)
  default     = {}
}

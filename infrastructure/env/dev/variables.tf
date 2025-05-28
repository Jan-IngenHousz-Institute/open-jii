variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "terraform_state_s3_bucket_name" {
  description = "Terraform state S3 Bucket name"
  type        = string
}

variable "docusaurus_s3_bucket_name" {
  description = "Docusaurus S3 Bucket name"
  type        = string
}

variable "timestream_database_name" {
  description = "Timestream database name"
  type        = string
}

variable "timestream_table_name" {
  description = "Timestream table name"
  type        = string
}

variable "iot_timestream_role_name" {
  description = "Name for the IAM role for IoT to write to Timestream"
  type        = string
}

variable "iot_timestream_policy_name" {
  description = "Name for the IAM policy for IoT to write to Timestream"
  type        = string
}

variable "kinesis_stream_name" {
  description = "Name of the Kinesis Data Stream"
  type        = string
}

variable "iot_kinesis_role_name" {
  description = "Name for the IoT Kinesis IAM Role"
  type        = string
}

variable "iot_kinesis_policy_name" {
  description = "Name for the IoT Kinesis IAM Policy"
  type        = string
}

variable "iot_logging_role_name" {
  description = "Name of the IAM role for IoT Core logging"
  type        = string
}

variable "iot_logging_policy_name" {
  description = "Name of the IAM policy for IoT Core logging"
  type        = string
}

variable "iot_cognito_identity_pool_name" {
  description = "Name for the Cognito Identity Pool"
  type        = string
  default     = "open-jii-dev-iot-identity-pool"
}

variable "databricks_account_id" {
  description = "Databricks Account ID (used as external_id in the assume role policy)"
  type        = string
  sensitive   = true
}

variable "databricks_client_id" {
  description = "The service principal's client ID for Databricks authentication"
  type        = string
  sensitive   = true
}

variable "databricks_client_secret" {
  description = "The service principal's client secret for Databricks authentication"
  type        = string
  sensitive   = true
}

variable "databricks_bucket_name" {
  description = "Root Databricks configuration S3 Bucket name"
  type        = string
}

variable "databricks_workspace_url" {
  description = "Databricks workspace name"
  type        = string
}

variable "unity_catalog_bucket_name" {
  description = "S3 bucket name for Unity Catalog metastore storage"
  type        = string
}

variable "kinesis_credential_id" {
  description = "Databricks storage credential ID for Kinesis"
  type        = string
}

# OpenNext Configuration
variable "opennext_project_name" {
  description = "Project name for OpenNext deployment"
  type        = string
  default     = "open-jii"
}

variable "opennext_environment" {
  description = "Environment name for OpenNext deployment"
  type        = string
  default     = "dev"
}

variable "opennext_domain_name" {
  description = "Custom domain name for the Next.js application (optional)"
  type        = string
  default     = ""
}

variable "opennext_subdomain" {
  description = "Subdomain for the Next.js application (optional)"
  type        = string
  default     = "app"
}

variable "opennext_certificate_arn" {
  description = "ACM certificate ARN for HTTPS (required if using custom domain)"
  type        = string
  default     = ""
}

variable "opennext_hosted_zone_id" {
  description = "Route53 hosted zone ID for DNS records (optional)"
  type        = string
  default     = ""
}

variable "opennext_enable_warming" {
  description = "Enable Lambda warming for better performance"
  type        = bool
  default     = true
}

variable "opennext_price_class" {
  description = "CloudFront price class (PriceClass_All, PriceClass_200, PriceClass_100)"
  type        = string
  default     = "PriceClass_100"
}

variable "image" {
  description = "Docker image for the ECS container"
  type        = string
  deafult     = "public.ecr.aws/nginx/nginx:latest"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Environment of the deployment (e.g., 'dev')"
  type        = string
  default     = "dev"
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

variable "databricks_host" {
  description = "Databricks workspace URL"
  type        = string
  sensitive   = true
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

variable "domain_name" {
  description = "Base domain name (e.g., my-company.com)"
  type        = string
}

variable "backend_ecr_max_images" {
  description = "Maximum number of images to keep in the backend ECR repository"
  type        = number
  default     = 10
}

variable "backend_container_port" {
  description = "The port on which the backend container will listen"
  type        = number
  default     = 3020
}

variable "backend_min_capacity" {
  description = "Minimum number of backend tasks to run"
  type        = number
  default     = 1
}

variable "backend_max_capacity" {
  description = "Maximum number of backend tasks to run"
  type        = number
  default     = 3
}

variable "backend_cpu_threshold" {
  description = "CPU threshold for backend autoscaling"
  type        = number
  default     = 80
}

variable "backend_health_check_path" {
  description = "Path for health checks on the backend service"
  type        = string
  default     = "/health"
}


# Authentication secrets
variable "auth_secret" {
  description = "Authentication secret token"
  type        = string
  sensitive   = true

}

variable "github_oauth_client_id" {
  description = "GitHub OAuth client ID"
  type        = string
  sensitive   = true
}

variable "github_oauth_client_secret" {
  description = "GitHub OAuth client secret"
  type        = string
  sensitive   = true
}
# Backend Databricks webhook secrets

variable "backend_webhook_api_key_id" {
  description = "Databricks webhook API key ID"
  type        = string
  sensitive   = true
}

variable "backend_webhook_api_key" {
  description = "Databricks webhook API key"
  type        = string
  sensitive   = true
}

variable "backend_webhook_secret" {
  description = "Databricks webhook secret (HMAC)"
  type        = string
  sensitive   = true
}

variable "backend_status_update_webhook_path" {
  description = "Path for status update webhooks on the backend service"
  type        = string
  default     = "/api/v1/experiments/:id/provisioning-status"
}

variable "backend_databricks_warehouse_id" {
  description = "Databricks warehouse ID for backend service"
  type        = string
  sensitive   = true
}

variable "api_cloudfront_header_value" {
  description = "Custom header value for CloudFront-ALB authentication"
  type        = string
  sensitive   = true
}

# Contentful configuration variables
variable "contentful_space_id" {
  description = "Contentful space ID"
  type        = string
  sensitive   = true
}

variable "contentful_access_token" {
  description = "Contentful access token"
  type        = string
  sensitive   = true
}

variable "contentful_preview_access_token" {
  description = "Contentful preview access token"
  type        = string
  sensitive   = true
}

variable "contentful_preview_secret" {
  description = "Contentful preview secret"
  type        = string
  sensitive   = true
}

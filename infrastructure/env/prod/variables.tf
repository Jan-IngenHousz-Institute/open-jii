variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Environment of the deployment (e.g., 'dev')"
  type        = string
  default     = "prod"
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

variable "slack_webhook_url" {
  description = "Slack webhook URL for Databricks job notifications"
  type        = string
  sensitive   = true
}

variable "slack_channel" {
  description = "Slack channel for monitoring notifications"
  type        = string
  default     = "#jii-monitoring"
}

variable "kinesis_credential_id" {
  description = "Databricks storage credential ID for Kinesis"
  type        = string
}

variable "dev_nameservers" {
  description = "Comma-separated list of nameservers for dev subdomain delegation"
  type        = string
}

variable "domain_name" {
  description = "Base domain name (e.g., my-company.com)"
  type        = string
  default     = "openjii.org"
}

variable "backend_container_port" {
  description = "Backend container port"
  type        = number
  default     = 3020
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

variable "orcid_oauth_client_id" {
  description = "ORCID OAuth client ID"
  type        = string
  sensitive   = true
}

variable "orcid_oauth_client_secret" {
  description = "ORCID OAuth client secret"
  type        = string
  sensitive   = true
}

# Backend x Databricks webhook secrets
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

variable "centralized_metastore_bucket_name" {
  description = "Name of the centralized S3 bucket for Unity Catalog metastore storage in data governance account"
  type        = string
  default     = "open-jii-databricks-uc-eu-central-1-metastore"
}

variable "posthog_key" {
  description = "PostHog project API key"
  type        = string
  sensitive   = true
}

variable "posthog_host" {
  description = "PostHog instance host URL"
  type        = string
  default     = "https://eu.i.posthog.com"
}


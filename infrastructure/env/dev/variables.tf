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
  description = "The service principal's client secret for Databricks authentication; unset under github-oidc"
  type        = string
  default     = null
  sensitive   = true
  ephemeral   = true
}

variable "databricks_auth_type" {
  description = "How the Databricks providers authenticate: github-oidc from a GitHub Actions job, databricks-cli with your own `databricks auth login` for a local plan, or oauth-m2m with the client secret"
  type        = string
  default     = "oauth-m2m"

  validation {
    condition     = contains(["oauth-m2m", "github-oidc", "databricks-cli"], var.databricks_auth_type)
    error_message = "databricks_auth_type must be oauth-m2m, github-oidc or databricks-cli."
  }
}

variable "databricks_host" {
  description = "Databricks workspace URL"
  type        = string
  sensitive   = true
}

variable "slack_webhook_url" {
  description = "The Slack incoming webhook for this environment: Databricks job events, Grafana alerts, and PostHog's error alerts for every environment"
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
# Mailchimp configuration variables
variable "centralized_metastore_bucket_name" {
  description = "Name of the centralized S3 bucket for Unity Catalog metastore storage in data governance account"
  type        = string
  default     = "open-jii-databricks-uc-eu-central-1-metastore"
}

variable "posthog_key" {
  description = "PostHog project API key"
  type        = string
  default     = "phc_bAOjcJ4S1mw8I5bSlDHUDmNeOaLuo4dhPiqWmyNdWLd"
}

variable "posthog_host" {
  description = "PostHog instance host URL"
  type        = string
  default     = "https://eu.i.posthog.com"
}

variable "grafana_auth_service_token" {
  description = "Grafana AMG service account token for API access"
  type        = string
  sensitive   = true
  ephemeral   = true
}

variable "posthog_tofu_api_key" {
  description = "PostHog personal API key OpenTofu manages the openJII project with"
  type        = string
  sensitive   = true
  ephemeral   = true
}

variable "posthog_grafana_api_key" {
  description = "Read-only PostHog personal API key the daily report queries error tracking with; empty until the Infinity plugin is installed"
  type        = string
  default     = ""
  sensitive   = true
}

variable "data_platform_sp_application_id" {
  description = "Application ID of the jii-data-platform deploy service principal (github-actions-jii-data-platform-sandbox-deploy). It runs the analyst gold pipelines in the sandbox workspace, which read this environment's centrum tables cross-catalog. Read-only; granted at catalog level in main.tf."
  type        = string
  default     = "122ea6e5-a082-45b5-9df6-ef5482868fdc"
}

variable "aws_region" {
  description = "AWS DR region (eu-west-1)"
  type        = string
  default     = "eu-west-1"
}

variable "environment" {
  description = "Environment name used for resource naming"
  type        = string
  default     = "dr"
}

variable "aurora_snapshot_identifier" {
  description = "RDS snapshot ARN (arn:aws:rds:eu-west-1:...) to restore Aurora from. When null (default), the DR env automatically discovers the most recent snapshot copied to the DR region by AWS Backup. Override only when you need to restore from a specific point in time."
  type        = string
  default     = null
}

variable "existing_route53_zone_id" {
  description = "Route53 hosted zone ID that already owns var.domain_name. For a prod failover this is the prod zone (openjii.org). For a dev drill this is the dev zone (dev.openjii.org). DR reuses this zone instead of creating a new one — supply via tfvars, never hardcode."
  type        = string
}

variable "enable_ses_cutover" {
  description = "Set to true only during an actual failover (not drills). When true, creates a new SES identity in eu-west-1 and writes DKIM TXT records to the prod Route53 zone. When false (default), the backend reuses the existing prod SES SMTP endpoint via var.prod_ses_smtp_server — no DNS changes are made and prod email is unaffected."
  type        = bool
  default     = false
}

variable "prod_ses_smtp_server" {
  description = "Prod SES SMTP server endpoint (e.g. email-smtp.eu-central-1.amazonaws.com). Used when enable_ses_cutover=false to reuse prod SES without touching the Route53 zone. Retrieve from the openjii-ses-secrets-prod secret in eu-central-1."
  type        = string
  default     = "email-smtp.eu-central-1.amazonaws.com"
}

variable "enable_dns_cutover" {
  description = "Set to true ONLY when performing the actual DR failover. When true, the CloudFront alias A-records and www CNAME are created/updated so that openjii.org resolves to DR resources. Default false lets you deploy and validate the entire stack without touching live traffic."
  type        = bool
  default     = false
}

variable "databricks_account_id" {
  description = "Databricks Account ID"
  type        = string
  sensitive   = true
}

variable "databricks_host" {
  description = "Databricks workspace URL (same prod workspace — global service)"
  type        = string
  sensitive   = true
}

variable "databricks_catalog_name" {
  description = "Databricks Unity Catalog name created in prod. Passed directly because the Databricks workspace is not re-provisioned in DR."
  type        = string
  default     = "open_jii_prod"
}

variable "databricks_service_principal_client_id" {
  description = "Client ID of the node service principal from the prod Databricks workspace."
  type        = string
  sensitive   = true
}

variable "databricks_service_principal_client_secret" {
  description = "Client secret of the node service principal from the prod Databricks workspace."
  type        = string
  sensitive   = true
}

variable "databricks_ambyte_processing_job_id" {
  description = "Databricks Ambyte Processing Job ID (from prod workspace). Used by the backend to trigger the job."
  type        = string
  sensitive   = true
}

variable "databricks_data_export_job_id" {
  description = "Databricks Data Export Job ID (from prod workspace)."
  type        = string
  sensitive   = true
}

variable "kinesis_credential_id" {
  description = "Databricks storage credential ID for Kinesis (same value as prod)"
  type        = string
}

# ── Shared with prod ─────────────────────────────────────────────────────────

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  sensitive   = true
}

variable "slack_channel" {
  description = "Slack channel for monitoring notifications"
  type        = string
  default     = "#jii-monitoring"
}

variable "domain_name" {
  description = "Apex domain for this DR target (e.g. openjii.org for a prod failover, dev.openjii.org for a dev drill). Must match the Route53 zone supplied via existing_route53_zone_id and the ACM certs that already exist in us-east-1. No default — always supply explicitly via tfvars."
  type        = string
}

variable "backend_container_port" {
  description = "Backend container port"
  type        = number
  default     = 3020
}

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

# SES module variables

variable "domain_name" {
  description = "Base domain name for SES (e.g., openjii.org)"
  type        = string
}

variable "subdomain" {
  description = "Subdomain for SES emails (e.g., 'mail' for mail.openjii.org). Leave empty to use root domain."
  type        = string
  default     = ""
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
}

variable "service_name" {
  description = "Service name for SES configuration set"
  type        = string
  default     = "transactional-email"
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for DNS records"
  type        = string
}

variable "region" {
  description = "AWS region for SES resources (e.g., eu-central-1)"
  type        = string
  default     = "eu-central-1"
}

variable "create_smtp_user" {
  description = "Whether to create an IAM user for SMTP authentication"
  type        = bool
  default     = true
}

variable "allowed_from_addresses" {
  description = "List of email addresses allowed to send from this domain"
  type        = list(string)
  default     = []
}

variable "dmarc_policy" {
  description = "DMARC policy record"
  type        = string
  default     = ""
}

variable "mx_records" {
  description = "MX records for the domain (optional, for receiving emails)"
  type        = list(string)
  default     = null
}

variable "enable_event_publishing" {
  description = "Whether to enable SES event publishing to CloudWatch"
  type        = bool
  default     = true
}

variable "enable_dmarc_reports" {
  description = "Whether to enable DMARC report collection infrastructure"
  type        = bool
  default     = true
}

variable "dmarc_report_retention_days" {
  description = "Number of days to retain DMARC reports in S3"
  type        = number
  default     = 365
}

variable "tags" {
  description = "A map of tags to assign to resources"
  type        = map(string)
  default     = {}
}

variable "use_environment_prefix" {
  description = "If true, prefixes resource names with the environment name (e.g., 'dev.domain.com'). If false, uses the base domain name (e.g., 'domain.com')."
  type        = bool
  default     = true
}

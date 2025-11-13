# Route53 module variables

variable "domain_name" {
  description = "Base domain name (e.g., my-company.com)"
  type        = string
}

variable "environment" {
  description = "Environment name/subdomain prefix (e.g., dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "cloudfront_records" {
  description = "Map of CloudFront records to create. Key is the subdomain prefix (e.g., 'docs' for docs.domain.com)"
  type = map(object({
    domain_name    = string
    hosted_zone_id = string
  }))
  default = {}
}

variable "tags" {
  description = "A map of tags to assign to resources"
  type        = map(string)
  default     = {}
}

variable "cloudfront_domain_configs" {
  description = "A map of configurations for CloudFront certificates in us-east-1. Key is a logical name (e.g., 'api', 'docs', 'web'), value is the FQDN."
  type        = map(string)
  default     = {}
}

variable "use_environment_prefix" {
  description = "If true, prefixes resource names with the environment name (e.g., 'dev.domain.com'). If false, uses the base domain name (e.g., 'domain.com')."
  type        = bool
  default     = true
}

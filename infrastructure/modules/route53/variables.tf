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

variable "existing_zone_id" {
  description = "ID of an existing Route53 hosted zone to reuse. When set, no new zone is created — used in the DR environment to reuse the prod zone without taking ownership of it."
  type        = string
  default     = null
}

variable "existing_cloudfront_certificate_arns" {
  description = "Map of logical name (api/docs/web) to existing ACM certificate ARN in us-east-1. When provided, no new CloudFront certs are created and DNS validation is skipped — used in DR to reuse prod's already-validated certs and avoid propagation delays."
  type        = map(string)
  default     = null
}

variable "create_dns_records" {
  description = "Whether to create the CloudFront alias A records and www CNAME. Set to false in DR to deploy all infrastructure safely before cutting over traffic. Flip to true only when performing the actual DNS failover."
  type        = bool
  default     = true
}

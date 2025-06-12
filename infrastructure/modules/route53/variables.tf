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

variable "create_certificate" {
  description = "Whether to create an ACM certificate for the domain and its subdomains"
  type        = bool
  default     = true
}

variable "alb_records" {
  description = "Map of ALB records to create. Key is the subdomain prefix (e.g., 'api' for api.domain.com)"
  type = map(object({
    dns_name = string
    zone_id  = string
  }))
  default = {}
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

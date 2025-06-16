variable "service_name" {
  description = "Name of the service for tagging and naming resources"
  type        = string
  default     = "backend-api"
}

variable "environment" {
  description = "Deployment environment (e.g. 'dev', 'prod')"
  type        = string
}

variable "alb_domain_name" {
  description = "Domain name of the ALB that CloudFront will use as an origin"
  type        = string
}

variable "custom_header_name" {
  description = "Name of the custom header used to restrict ALB access to CloudFront"
  type        = string
  default     = "X-Origin-Verify"
}

variable "custom_header_value" {
  description = "Value of the custom header used to restrict ALB access to CloudFront (generated with OpenSSL)"
  type        = string
  sensitive   = true
}

variable "price_class" {
  description = "CloudFront price class (PriceClass_All, PriceClass_200, PriceClass_100)"
  type        = string
  default     = "PriceClass_100"
}

variable "default_ttl" {
  description = "Default TTL for cached objects (in seconds)"
  type        = number
  default     = 0 # Default to no caching for APIs
}

variable "max_ttl" {
  description = "Maximum TTL for cached objects (in seconds)"
  type        = number
  default     = 0 # Default to no caching for APIs
}

variable "forwarded_headers" {
  description = "List of headers to forward to the origin"
  type        = list(string)
  default     = ["Authorization", "Host", "Origin", "Referer", "User-Agent"]
}

variable "custom_domain" {
  description = "Custom domain name for the CloudFront distribution (e.g. api.example.com)"
  type        = string
  default     = ""
}

variable "blocked_countries" {
  description = "List of countries to block (ISO 3166-1 alpha-2 codes)"
  type        = list(string)
  default     = []
}

variable "certificate_arn" {
  description = "ARN of the ACM certificate for the custom domain"
  type        = string
  default     = ""
}

variable "waf_acl_id" {
  description = "ARN of the WAFv2 ACL to associate with the CloudFront distribution"
  type        = string
  default     = ""
}

variable "enable_logging" {
  description = "Enable CloudFront access logging"
  type        = bool
  default     = true
}

variable "log_bucket" {
  description = "S3 bucket name for CloudFront access logs"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

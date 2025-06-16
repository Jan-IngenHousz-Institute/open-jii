variable "aws_region" {
  description = "The AWS region for deployment"
  type        = string
}

variable "bucket_name" {
  description = "The S3 bucket name (used for origin ID)"
  type        = string
}

variable "default_root_object" {
  description = "The default root object for CloudFront (e.g., index.html)"
  type        = string
  default     = "index.html"
}

variable "certificate_arn" {
  description = "ARN of the ACM certificate for HTTPS (if using custom domain)"
  type        = string
  default     = ""
}

variable "custom_domain" {
  description = "Custom domain for CloudFront distribution (e.g., docs.dev.my-company.com)"
  type        = string
  default     = ""
}

variable "waf_acl_id" {
  description = "The ARN of the WAF Web ACL to associate with the CloudFront distribution."
  type        = string
  default     = null
}

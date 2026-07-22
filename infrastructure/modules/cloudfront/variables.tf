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

variable "enable_redirect_function" {
  description = "Attach a viewer-request CloudFront Function that 301-redirects legacy paths (from redirect_map) and rewrites clean URLs to static-export .html objects. Off by default so other module consumers are unaffected."
  type        = bool
  default     = false
}

variable "redirect_map" {
  description = "Old-path -> new-path 301 redirect map, templated into the CloudFront Function. Only used when enable_redirect_function is true."
  type        = map(string)
  default     = {}
}

variable "enable_spa_error_response" {
  description = "When true, 403/404 origin errors are served as /index.html with HTTP 200 (SPA/client-side-routing behavior). Set false for statically-exported sites that ship a real 404.html (served as HTTP 404)."
  type        = bool
  default     = true
}

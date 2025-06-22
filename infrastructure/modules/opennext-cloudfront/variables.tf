variable "project_name" {
  description = "Name of the project (used for resource naming)"
  type        = string
}

variable "assets_bucket_name" {
  description = "Name of the S3 assets bucket"
  type        = string
}

variable "assets_bucket_domain_name" {
  description = "Domain name of the S3 assets bucket"
  type        = string
  sensitive   = true
}

variable "server_function_url_domain" {
  description = "Domain of the server Lambda function URL"
  type        = string
  sensitive   = true
}

variable "image_function_url_domain" {
  description = "Domain of the image optimization Lambda function URL"
  type        = string
  sensitive   = true
}

variable "aliases" {
  description = "List of custom domain aliases"
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for custom domain"
  type        = string
  default     = null
}

variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"

  validation {
    condition = contains([
      "PriceClass_All",
      "PriceClass_200",
      "PriceClass_100"
    ], var.price_class)
    error_message = "Price class must be PriceClass_All, PriceClass_200, or PriceClass_100."
  }
}

variable "waf_acl_id" {
  description = "ARN of the WAFv2 ACL to associate with the CloudFront distribution"
  type        = string
  default     = ""
}

variable "enable_logging" {
  description = "Enable CloudFront access logging"
  type        = bool
  default     = false
}

variable "log_bucket" {
  description = "S3 bucket name for CloudFront access logs"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

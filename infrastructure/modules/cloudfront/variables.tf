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


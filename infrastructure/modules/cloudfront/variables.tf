variable "bucket_name" {
  description = "The S3 bucket name (used for origin ID)."
  type        = string
}

variable "s3_bucket_rest_endpoint" {
  description = "The REST endpoint for the S3 bucket (e.g., my-bucket.s3.us-east-1.amazonaws.com)."
  type        = string
}

variable "default_root_object" {
  description = "The default root object for CloudFront (e.g., index.html)."
  type        = string
  default     = "index.html"
}

# The OAI value is the value of the CloudFront origin access identity path.
variable "oai_access_identity" {
  description = "The CloudFront Origin Access Identity (OAI) value (cloudfront_access_identity_path)."
  type        = string
}

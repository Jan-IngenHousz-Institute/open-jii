variable "bucket_name" {
  description = "The name of the S3 bucket for hosting the site."
  type        = string
}

variable "aws_region" {
  description = "The AWS region for deployment."
  type        = string
  default     = "eu-central-1"
}

# This must be provided from the root module (from the OAI resource).
variable "oai_canonical_user_id" {
  description = "The canonical user ID of the CloudFront Origin Access Identity."
  type        = string
}

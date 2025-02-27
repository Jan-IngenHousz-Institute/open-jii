variable "bucket_name" {
  description = "The name of the S3 bucket for hosting the site"
  type        = string
}

variable "cloudfront_distribution_arn" {
  description = "The ARN of the CloudFront distribution that will access the bucket via OAC"
  type        = string
}

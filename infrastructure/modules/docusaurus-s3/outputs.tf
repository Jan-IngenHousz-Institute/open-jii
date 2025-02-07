output "bucket_name" {
  description = "The S3 bucket name."
  value       = aws_s3_bucket.docusaurus.bucket
}

output "s3_bucket_rest_endpoint" {
  description = "The S3 REST endpoint for the bucket (used as CloudFront origin)."
  value = format("%s.s3.%s.amazonaws.com", aws_s3_bucket.docusaurus.bucket, var.aws_region)
}

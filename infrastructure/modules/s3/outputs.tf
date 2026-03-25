output "bucket_id" {
  description = "The ID of the S3 bucket"
  value       = aws_s3_bucket.bucket.id
}

output "bucket_arn" {
  description = "The ARN of the S3 bucket"
  value       = aws_s3_bucket.bucket.arn
}

output "bucket_domain_name" {
  description = "The domain name of the S3 bucket"
  value       = aws_s3_bucket.bucket.bucket_domain_name
}

output "bucket_name" {
  description = "The name of the S3 bucket"
  value       = aws_s3_bucket.bucket.bucket
}

output "dr_bucket_arn" {
  description = "ARN of the DR replica bucket (only set when enable_crr = true)"
  value       = var.enable_crr ? aws_s3_bucket.dr_bucket[0].arn : null
}

output "dr_bucket_name" {
  description = "Name of the DR replica bucket (only set when enable_crr = true)"
  value       = var.enable_crr ? aws_s3_bucket.dr_bucket[0].id : null
}

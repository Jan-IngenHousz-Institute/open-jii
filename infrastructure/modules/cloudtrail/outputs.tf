output "trail_name" {
  description = "Name of the CloudTrail trail"
  value       = aws_cloudtrail.cloud_trail.name
}

output "bucket_name" {
  description = "Name of the S3 bucket that receives the trail's log files"
  value       = aws_s3_bucket.cloud_trail_bucket.id
}

output "kms_key_arn" {
  description = "ARN of the customer-managed KMS key that encrypts the log files"
  value       = aws_kms_key.cloud_trail.arn
}

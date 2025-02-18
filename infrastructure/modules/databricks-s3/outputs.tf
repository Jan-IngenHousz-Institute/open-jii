output "bucket_name" {
  description = "S3 Bucket Name"
  value       = aws_s3_bucket.root_storage_bucket.bucket
}

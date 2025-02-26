output "bucket_name" {
  description = "S3 Bucket Name"
  value       = aws_s3_bucket.databricks_root_storage_bucket.bucket
}

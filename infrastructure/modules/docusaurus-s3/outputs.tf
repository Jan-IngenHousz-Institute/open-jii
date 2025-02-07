output "bucket_name" {
  description = "The S3 bucket name."
  value       = aws_s3_bucket.docusaurus.bucket
}

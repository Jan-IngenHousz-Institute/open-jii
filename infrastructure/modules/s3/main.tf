resource "aws_s3_bucket" "test-bucket" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_versioning" "test-bucket" {
  bucket = aws_s3_bucket.test-bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "test-bucket" {
  bucket = aws_s3_bucket.test-bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
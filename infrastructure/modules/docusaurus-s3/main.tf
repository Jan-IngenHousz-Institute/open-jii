
resource "aws_s3_bucket" "docusaurus" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_public_access_block" "public_access" {
  bucket                  = aws_s3_bucket.docusaurus.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "bucket_policy" {
  bucket = aws_s3_bucket.docusaurus.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid    = "AllowCloudFrontOAI",
        Effect = "Allow",
        Principal = {
          // Only the OAI (its canonical user) can get objects.
          CanonicalUser = var.oai_canonical_user_id
        },
        Action   = "s3:GetObject",
        Resource = "arn:aws:s3:::${var.bucket_name}/*"
      }
    ]
  })
}

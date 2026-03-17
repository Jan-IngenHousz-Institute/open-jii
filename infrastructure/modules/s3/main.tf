resource "aws_s3_bucket" "bucket" {
  bucket = var.bucket_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "versioning" {
  bucket = aws_s3_bucket.bucket.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_ownership_controls" "ownership" {
  bucket = aws_s3_bucket.bucket.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "acl" {
  bucket     = aws_s3_bucket.bucket.id
  acl        = "private"
  depends_on = [aws_s3_bucket_ownership_controls.ownership]
}

resource "aws_s3_bucket_server_side_encryption_configuration" "encryption" {
  bucket = aws_s3_bucket.bucket.bucket

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256" # SSE-S3 encryption
    }
  }
}

resource "aws_s3_bucket_public_access_block" "block" {
  bucket                  = aws_s3_bucket.bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Optional: Add CloudFront-specific bucket policy when a distribution ARN is provided
resource "aws_s3_bucket_policy" "cloudfront_access" {
  count  = var.cloudfront_distribution_arn != null ? 1 : 0
  bucket = aws_s3_bucket.bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.bucket.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = var.cloudfront_distribution_arn
          }
        }
      }
    ]
  })
}

resource "aws_s3_bucket_policy" "custom_policy" {
  count  = var.custom_policy_json != null ? 1 : 0
  bucket = aws_s3_bucket.bucket.id
  policy = var.custom_policy_json
}

# ──────────────────────────────────────────────────────────────────────────────
# Cross-Region Replication — only created when enable_crr = true
# Continuously replicates all objects to a DR region bucket.
# AWS requires versioning enabled on both source and destination.
# ──────────────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "dr_bucket" {
  provider = aws.dr
  count    = var.enable_crr ? 1 : 0
  bucket   = var.dr_bucket_name != null ? var.dr_bucket_name : "${var.bucket_name}-dr"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "dr_versioning" {
  provider = aws.dr
  count    = var.enable_crr ? 1 : 0
  bucket   = aws_s3_bucket.dr_bucket[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "dr_encryption" {
  provider = aws.dr
  count    = var.enable_crr ? 1 : 0
  bucket   = aws_s3_bucket.dr_bucket[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "dr_block" {
  provider                = aws.dr
  count                   = var.enable_crr ? 1 : 0
  bucket                  = aws_s3_bucket.dr_bucket[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_iam_role" "replication" {
  count = var.enable_crr ? 1 : 0
  name  = "s3-crr-role-${var.bucket_name}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "replication" {
  count = var.enable_crr ? 1 : 0
  name  = "s3-crr-policy-${var.bucket_name}"
  role  = aws_iam_role.replication[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetReplicationConfiguration", "s3:ListBucket"]
        Resource = aws_s3_bucket.bucket.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObjectVersionForReplication", "s3:GetObjectVersionAcl", "s3:GetObjectVersionTagging"]
        Resource = "${aws_s3_bucket.bucket.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ReplicateObject", "s3:ReplicateDelete", "s3:ReplicateTags"]
        Resource = "${aws_s3_bucket.dr_bucket[0].arn}/*"
      }
    ]
  })
}

resource "aws_s3_bucket_versioning" "crr_source_versioning" {
  count  = var.enable_crr && !var.enable_versioning ? 1 : 0
  bucket = aws_s3_bucket.bucket.id

  versioning_configuration {
    status = "Enabled"
  }

  depends_on = [aws_s3_bucket_versioning.versioning]
}

resource "aws_s3_bucket_replication_configuration" "crr" {
  count  = var.enable_crr ? 1 : 0
  bucket = aws_s3_bucket.bucket.id
  role   = aws_iam_role.replication[0].arn

  rule {
    id     = "replicate-all-to-dr"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.dr_bucket[0].arn
      storage_class = "STANDARD_IA" # Cost-optimised storage class for rarely-accessed DR data
    }
  }

  depends_on = [
    aws_s3_bucket_versioning.versioning,
    aws_s3_bucket_versioning.crr_source_versioning,
    aws_s3_bucket_versioning.dr_versioning,
  ]
}

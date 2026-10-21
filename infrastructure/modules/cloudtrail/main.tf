data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  trail_name = "${var.project_name}-${var.environment}-cloudtrail"
  # Built from its parts: the trail references the key, so the key policy cannot reference the trail.
  trail_arn = "arn:aws:cloudtrail:${var.region}:${local.account_id}:trail/${local.trail_name}"
}

resource "aws_cloudtrail" "cloud_trail" {
  name                          = local.trail_name
  s3_bucket_name                = aws_s3_bucket.cloud_trail_bucket.id
  kms_key_id                    = aws_kms_key.cloud_trail.arn
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true

  depends_on = [aws_s3_bucket_policy.cloud_trail_bucket_policy]
}

data "aws_iam_policy_document" "cloud_trail_key" {
  statement {
    sid       = "EnableRootAccountAdministration"
    effect    = "Allow"
    actions   = ["kms:*"]
    resources = ["*"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${local.account_id}:root"]
    }
  }

  statement {
    sid       = "AllowCloudTrailEncryptLogs"
    effect    = "Allow"
    actions   = ["kms:GenerateDataKey*"]
    resources = ["*"]

    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [local.trail_arn]
    }

    condition {
      test     = "StringLike"
      variable = "kms:EncryptionContext:aws:cloudtrail:arn"
      values   = ["arn:aws:cloudtrail:*:${local.account_id}:trail/*"]
    }
  }

  statement {
    sid       = "AllowCloudTrailDescribeKey"
    effect    = "Allow"
    actions   = ["kms:DescribeKey"]
    resources = ["*"]

    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [local.trail_arn]
    }
  }

  statement {
    sid       = "AllowAccountToDecryptLogs"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = ["*"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${local.account_id}:root"]
    }

    condition {
      test     = "StringEquals"
      variable = "kms:CallerAccount"
      values   = [local.account_id]
    }

    condition {
      test     = "Null"
      variable = "kms:EncryptionContext:aws:cloudtrail:arn"
      values   = ["false"]
    }
  }
}

resource "aws_kms_key" "cloud_trail" {
  description             = "Encrypts the ${local.trail_name} log files"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.cloud_trail_key.json
}

resource "aws_kms_alias" "cloud_trail" {
  name          = "alias/${local.trail_name}"
  target_key_id = aws_kms_key.cloud_trail.key_id
}

resource "aws_s3_bucket" "cloud_trail_bucket" {
  bucket = "${var.project_name}-${var.environment}-trail-bucket"
}

resource "aws_s3_bucket_public_access_block" "cloud_trail_bucket_public_access_block" {
  bucket = aws_s3_bucket.cloud_trail_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "cloud_trail_bucket" {
  bucket = aws_s3_bucket.cloud_trail_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Bucket Keys stay off: CloudTrail's own reads and writes carry no KMS charge, and with a
# Bucket Key the KMS request no longer carries the trail ARN the key policy conditions on.
resource "aws_s3_bucket_server_side_encryption_configuration" "cloud_trail_bucket" {
  bucket = aws_s3_bucket.cloud_trail_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.cloud_trail.arn
    }
    bucket_key_enabled = false
  }
}

# Object Lock can only be enabled once versioning is on, and cannot be turned off again.
resource "aws_s3_bucket_object_lock_configuration" "cloud_trail_bucket" {
  bucket = aws_s3_bucket.cloud_trail_bucket.id

  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = var.log_retention_days
    }
  }

  depends_on = [aws_s3_bucket_versioning.cloud_trail_bucket]
}

resource "aws_s3_bucket_lifecycle_configuration" "cloud_trail_bucket" {
  bucket = aws_s3_bucket.cloud_trail_bucket.id

  rule {
    id     = "archive-then-expire-trail-logs"
    status = "Enabled"

    filter {}

    transition {
      days          = var.log_archive_after_days
      storage_class = "GLACIER"
    }

    expiration {
      days = var.log_expiration_days
    }

    noncurrent_version_expiration {
      noncurrent_days = var.log_expiration_days
    }
  }

  depends_on = [aws_s3_bucket_versioning.cloud_trail_bucket]

  lifecycle {
    precondition {
      condition     = var.log_expiration_days > var.log_retention_days
      error_message = "log_expiration_days must be longer than the Object Lock retention (log_retention_days)."
    }
  }
}

data "aws_iam_policy_document" "cloud_trail_bucket_policy" {
  statement {
    sid    = "DenyNonTLS"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.cloud_trail_bucket.arn,
      "${aws_s3_bucket.cloud_trail_bucket.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  statement {
    sid    = "AWSCloudTrailAclCheck"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }

    actions   = ["s3:GetBucketAcl"]
    resources = [aws_s3_bucket.cloud_trail_bucket.arn]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [local.trail_arn]
    }
  }

  statement {
    sid    = "AWSCloudTrailWrite"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }

    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.cloud_trail_bucket.arn}/AWSLogs/${local.account_id}/*"]

    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [local.trail_arn]
    }
  }
}

resource "aws_s3_bucket_policy" "cloud_trail_bucket_policy" {
  bucket = aws_s3_bucket.cloud_trail_bucket.id
  policy = data.aws_iam_policy_document.cloud_trail_bucket_policy.json

  depends_on = [aws_s3_bucket.cloud_trail_bucket, data.aws_iam_policy_document.cloud_trail_bucket_policy]
}

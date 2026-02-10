data "aws_caller_identity" "current" {}

locals {
  trail_name = "${var.project_name}-${var.environment}-cloudtrail"
}

resource "aws_cloudtrail" "cloud_trail" {
  name                          = local.trail_name
  s3_bucket_name                = aws_s3_bucket.cloud_trail_bucket.id
  include_global_service_events = true
  is_multi_region_trail         = true

  depends_on = [aws_s3_bucket_policy.cloud_trail_bucket_policy]
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

data "aws_iam_policy_document" "cloud_trail_bucket_policy" {
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
      values   = ["arn:aws:cloudtrail:${var.region}:${data.aws_caller_identity.current.account_id}:trail/${local.trail_name}"]
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
    resources = ["${aws_s3_bucket.cloud_trail_bucket.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"]

    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = ["arn:aws:cloudtrail:${var.region}:${data.aws_caller_identity.current.account_id}:trail/${local.trail_name}"]
    }
  }
}

resource "aws_s3_bucket_policy" "cloud_trail_bucket_policy" {
  bucket = aws_s3_bucket.cloud_trail_bucket.id
  policy = data.aws_iam_policy_document.cloud_trail_bucket_policy.json

  depends_on = [aws_s3_bucket.cloud_trail_bucket, data.aws_iam_policy_document.cloud_trail_bucket_policy]
}

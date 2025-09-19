# AWS SES module for transactional email sending
# This module sets up SES with domain verification, DKIM signing, and proper IAM configuration

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data source for current AWS account ID (still needed for policies)
data "aws_caller_identity" "current" {}

locals {
  # Region from variable for cleaner references
  region = var.region

  # Construct the from domain based on subdomain, environment, and domain
  from_domain = var.subdomain != "" ? "${var.subdomain}.${var.environment}.${var.domain_name}" : "${var.environment}.${var.domain_name}"

  # Generate DMARC policy with dynamic domain
  dmarc_policy = var.dmarc_policy != "" ? var.dmarc_policy : "v=DMARC1; p=quarantine; adkim=s; aspf=s; pct=100; rua=mailto:dmarc@${local.from_domain}"
}

# SES Domain Identity - verifies domain ownership
resource "aws_ses_domain_identity" "main" {
  domain = local.from_domain
}

# SES Domain Verification TXT Record
resource "aws_route53_record" "ses_verification" {
  zone_id = var.route53_zone_id
  name    = "_amazonses.${local.from_domain}"
  type    = "TXT"
  ttl     = 300
  records = [aws_ses_domain_identity.main.verification_token]
}

# Wait for domain verification to complete
resource "aws_ses_domain_identity_verification" "main" {
  domain = aws_ses_domain_identity.main.id

  depends_on = [aws_route53_record.ses_verification]

  timeouts {
    create = "5m"
  }
}

# DKIM Signing - enhances email deliverability and prevents spoofing
resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# DKIM CNAME Records (3 records for DKIM tokens)
resource "aws_route53_record" "dkim_records" {
  count   = 3
  zone_id = var.route53_zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey.${local.from_domain}"
  type    = "CNAME"
  ttl     = 300
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# Set up a custom MAIL FROM domain for better SPF alignment
resource "aws_ses_domain_mail_from" "this" {
  domain                 = aws_ses_domain_identity.main.domain
  mail_from_domain       = "bounce.${local.from_domain}"
  behavior_on_mx_failure = "UseDefaultValue"
}

# SPF Record for email authentication on the main domain
resource "aws_route53_record" "spf" {
  zone_id = var.route53_zone_id
  name    = local.from_domain
  type    = "TXT"
  ttl     = 300
  records = ["v=spf1 include:amazonses.com -all"]
}

# SPF Record for the bounce domain
resource "aws_route53_record" "bounce_spf" {
  zone_id = var.route53_zone_id
  name    = "bounce.${local.from_domain}"
  type    = "TXT"
  ttl     = 300
  records = ["v=spf1 include:amazonses.com -all"]
}

# MX record for the bounce domain
resource "aws_route53_record" "bounce_mx" {
  zone_id = var.route53_zone_id
  name    = "bounce.${local.from_domain}"
  type    = "MX"
  ttl     = 300
  records = ["10 feedback-smtp.${local.region}.amazonses.com"]
}

# DMARC Record for email authentication and reporting
resource "aws_route53_record" "dmarc" {
  zone_id = var.route53_zone_id
  name    = "_dmarc.${local.from_domain}"
  type    = "TXT"
  ttl     = 300
  records = [local.dmarc_policy]
}

# S3 bucket for DMARC reports
resource "aws_s3_bucket" "dmarc_reports" {
  count  = var.enable_dmarc_reports ? 1 : 0
  bucket = "${var.environment}-dmarc-reports-${replace(local.from_domain, ".", "-")}"

  tags = merge(
    {
      Name        = "${var.environment}-dmarc-reports"
      Environment = var.environment
      Purpose     = "DMARC Report Storage"
    },
    var.tags
  )
}

# Block public access to the DMARC reports bucket
resource "aws_s3_bucket_public_access_block" "dmarc_reports" {
  count                   = var.enable_dmarc_reports ? 1 : 0
  bucket                  = aws_s3_bucket.dmarc_reports[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enforce bucket ownership for all objects
resource "aws_s3_bucket_ownership_controls" "dmarc_reports" {
  count  = var.enable_dmarc_reports ? 1 : 0
  bucket = aws_s3_bucket.dmarc_reports[0].id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "dmarc_reports" {
  count  = var.enable_dmarc_reports ? 1 : 0
  bucket = aws_s3_bucket.dmarc_reports[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "dmarc_reports" {
  count  = var.enable_dmarc_reports ? 1 : 0
  bucket = aws_s3_bucket.dmarc_reports[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "dmarc_reports" {
  count  = var.enable_dmarc_reports ? 1 : 0
  bucket = aws_s3_bucket.dmarc_reports[0].id

  rule {
    id     = "dmarc_reports_lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 60
      storage_class = "GLACIER"
    }

    expiration {
      days = var.dmarc_report_retention_days
    }
  }
}

# SES Receipt Rule Set for DMARC reports (if receiving reports)
resource "aws_ses_receipt_rule_set" "dmarc_reports" {
  count         = var.enable_dmarc_reports ? 1 : 0
  rule_set_name = "${var.environment}-dmarc-reports"
}

resource "aws_ses_receipt_rule" "dmarc_reports" {
  count         = var.enable_dmarc_reports ? 1 : 0
  name          = "dmarc-reports-rule"
  rule_set_name = aws_ses_receipt_rule_set.dmarc_reports[0].rule_set_name
  recipients    = ["dmarc@${local.from_domain}"]
  enabled       = true
  scan_enabled  = true

  s3_action {
    bucket_name       = aws_s3_bucket.dmarc_reports[0].bucket
    object_key_prefix = "dmarc-reports/"
    position          = 1
  }
}

# Activate the receipt rule set
resource "aws_ses_active_receipt_rule_set" "this" {
  count         = var.enable_dmarc_reports ? 1 : 0
  rule_set_name = aws_ses_receipt_rule_set.dmarc_reports[0].rule_set_name
}

# IAM policy for SES to write to S3
resource "aws_s3_bucket_policy" "dmarc_reports" {
  count  = var.enable_dmarc_reports ? 1 : 0
  bucket = aws_s3_bucket.dmarc_reports[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSESPuts"
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.dmarc_reports[0].arn}/dmarc-reports/*"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          },
          "ArnLike": {
            "aws:SourceArn": "arn:aws:ses:${local.region}:${data.aws_caller_identity.current.account_id}:receipt-rule-set/${aws_ses_receipt_rule_set.dmarc_reports[0].rule_set_name}:*"
          }
        }
      },
      {
        Sid    = "DenyInsecureTransport"
        Effect = "Deny"
        Principal = {
          "AWS" = "*"
        }
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.dmarc_reports[0].arn,
          "${aws_s3_bucket.dmarc_reports[0].arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# MX Record for receiving emails - uses current region
resource "aws_route53_record" "mx" {
  count   = var.mx_records != null ? 1 : (var.enable_dmarc_reports ? 1 : 0)
  zone_id = var.route53_zone_id
  name    = local.from_domain
  type    = "MX"
  ttl     = 300
  records = var.mx_records != null ? var.mx_records : ["10 inbound-smtp.${local.region}.amazonaws.com"]
}

# IAM User for SES SMTP authentication
resource "aws_iam_user" "ses_smtp" {
  count = var.create_smtp_user ? 1 : 0
  name  = "${var.environment}-ses-smtp-user"
  path  = "/ses/"

  tags = merge(
    {
      Name        = "${var.environment}-ses-smtp-user"
      Environment = var.environment
      Purpose     = "SES SMTP Authentication"
    },
    var.tags
  )
}

# IAM Access Key for SMTP user
resource "aws_iam_access_key" "ses_smtp" {
  count = var.create_smtp_user ? 1 : 0
  user  = aws_iam_user.ses_smtp[0].name
}

# IAM Policy for SES sending permissions
resource "aws_iam_policy" "ses_sending" {
  count       = var.create_smtp_user ? 1 : 0
  name        = "${var.environment}-ses-sending-policy"
  description = "Allow SES sending with from-address guard and config set"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
        Condition = {
          "ForAnyValue:StringEquals" = {
            "ses:FromAddress" = var.allowed_from_addresses
          }
          StringLike = {
            "ses:ConfigurationSet" = aws_ses_configuration_set.main.name
          }
        }
      }
    ]
  })

  tags = merge(
    {
      Name        = "${var.environment}-ses-sending-policy"
      Environment = var.environment
    },
    var.tags
  )
}

# Attach SES policy to SMTP user
resource "aws_iam_user_policy_attachment" "ses_smtp_policy" {
  count      = var.create_smtp_user ? 1 : 0
  user       = aws_iam_user.ses_smtp[0].name
  policy_arn = aws_iam_policy.ses_sending[0].arn
}

# Configuration Set for tracking and reputation management
resource "aws_ses_configuration_set" "main" {
  name = "${var.environment}-${var.service_name}"

  delivery_options {
    tls_policy = "Require"
  }

  reputation_metrics_enabled = true
}

# Event Destination for bounce and complaint tracking (optional)
resource "aws_ses_event_destination" "cloudwatch" {
  count                  = var.enable_event_publishing ? 1 : 0
  name                   = "cloudwatch-event-destination"
  configuration_set_name = aws_ses_configuration_set.main.name
  enabled                = true
  matching_types         = ["bounce", "complaint", "delivery", "send", "reject"]

  cloudwatch_destination {
    default_value  = "default"
    dimension_name = "MessageTag"
    value_source   = "messageTag"
  }
}

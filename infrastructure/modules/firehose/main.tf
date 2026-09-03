resource "aws_iam_role" "firehose_s3_role" {
  name = var.role_name
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "firehose.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_policy" "firehose_s3_policy" {
  name = var.policy_name
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject"
        ],
        Resource = [
          var.destination_bucket_arn,
          "${var.destination_bucket_arn}/*"
        ]
      },
      {
        Effect   = "Allow",
        Action   = ["logs:PutLogEvents"],
        Resource = "${aws_cloudwatch_log_group.firehose.arn}:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "firehose_s3_attach" {
  role       = aws_iam_role.firehose_s3_role.name
  policy_arn = aws_iam_policy.firehose_s3_policy.arn
}

resource "aws_cloudwatch_log_group" "firehose" {
  name              = "/aws/kinesisfirehose/${var.delivery_stream_name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_cloudwatch_log_stream" "destination_delivery" {
  name           = "DestinationDelivery"
  log_group_name = aws_cloudwatch_log_group.firehose.name
}

resource "aws_kinesis_firehose_delivery_stream" "this" {
  name        = var.delivery_stream_name
  destination = "extended_s3"

  server_side_encryption {
    enabled  = true
    key_type = "AWS_OWNED_CMK"
  }

  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose_s3_role.arn
    bucket_arn = var.destination_bucket_arn

    prefix              = var.s3_prefix
    error_output_prefix = var.error_output_prefix

    buffering_size     = var.buffering_size_mb
    buffering_interval = var.buffering_interval_seconds
    compression_format = "GZIP"

    cloudwatch_logging_options {
      enabled         = true
      log_group_name  = aws_cloudwatch_log_group.firehose.name
      log_stream_name = aws_cloudwatch_log_stream.destination_delivery.name
    }
  }

  tags = var.tags
}

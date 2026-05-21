data "aws_caller_identity" "current" {}

locals {
  # Load the AsyncAPI YAML file.
  asyncapi = yamldecode(file("${path.module}/../../../asyncapi.yaml"))

  # Get all channel keys.
  all_channels = keys(local.asyncapi.channels)

  # Compute, for each channel, a mapping of parameter name to its topic index.
  # Inline computation without "let":  
  # For each channel, we first filter out the parameter segments and remove the braces.
  # Then, the topic index for each parameter is: static_count + its index in the filtered list + 1.
  iot_parameter_to_topic_index = {
    for channel in local.all_channels : channel =>
    { for idx, name in [
      for seg in split("/", channel) :
      substr(seg, 1, length(seg) - 2) if startswith(seg, "{") && endswith(seg, "}")
      ] : name => (length([
        for seg in split("/", channel) : seg
        if !(startswith(seg, "{") && endswith(seg, "}"))
      ]) + idx + 1)
    }
  }

  # Map each channel's operations to IoT actions.
  actions_by_channel = {
    for channel, details in local.asyncapi.channels : channel =>
    concat(
      contains(keys(details), "subscribe") ? ["iot:Publish"] : [],
      contains(keys(details), "publish") ? ["iot:Subscribe", "iot:Receive"] : []
    )
  }

  # Compute a friendly name for each IoT policy based on the static portion of the channel.
  iot_policy_names = {
    for channel in local.all_channels : channel =>
    "open_jii_${var.environment}_iot_policy_${replace(trim(split("/{", channel)[0], "/"), "/", "_")}"
  }

  # Compute a friendly name for each IoT topic rule based on the static portion of the channel.
  iot_rule_names = {
    for channel in local.all_channels : channel =>
    "open_jii_${var.environment}_iot_rule_${replace(trim(split("/{", channel)[0], "/"), "/", "_")}"
  }

  # Convert the channel into a topic filter by replacing any parameter segment with "+"
  iot_topic_filters = {
    for channel in local.all_channels : channel =>
    join("/", [
      for segment in split("/", channel) :
      (startswith(segment, "{") && endswith(segment, "}")) ? "+" : segment
    ])
  }
}

# Configure IoT Core logging - Use the role from cloudwatch module
resource "aws_iot_logging_options" "iot_core_logging" {
  default_log_level = var.default_log_level
  role_arn          = var.cloudwatch_role_arn
}

# -----------------
# AWS IoT Policies
# -----------------
resource "aws_iot_policy" "iot_policy" {
  for_each = local.asyncapi.channels

  name = local.iot_policy_names[each.key]
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "iot:Connect",
        Resource = "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:client/$${iot:ClientId}"
      },
      {
        Effect   = "Allow",
        Action   = distinct(local.actions_by_channel[each.key]),
        Resource = "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topic/${replace(local.iot_topic_filters[each.key], "+", "*")}"
      }
    ]
  })
}

# --------------------------------------------
# IAM Role and Policy for Kinesis Integration
# --------------------------------------------
resource "aws_iam_role" "iot_kinesis_role" {
  name = var.iot_kinesis_role_name
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "iot.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_policy" "iot_kinesis_policy" {
  name = var.iot_kinesis_policy_name
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Action = [
        "kinesis:PutRecord",
        "kinesis:PutRecords"
      ],
      Resource = var.kinesis_stream_arn
    }]
  })
}

resource "aws_iam_role_policy_attachment" "iot_kinesis_attach" {
  role       = aws_iam_role.iot_kinesis_role.name
  policy_arn = aws_iam_policy.iot_kinesis_policy.arn
}

# ----------------------------------------
# IAM Role and Policy for S3 Archive
# ----------------------------------------
resource "aws_iam_role" "iot_s3_role" {
  name = var.iot_s3_role_name
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "iot.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_policy" "iot_s3_policy" {
  name = var.iot_s3_policy_name
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow",
      Action   = ["s3:PutObject"],
      Resource = "${var.s3_archive_bucket_arn}/*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "iot_s3_attach" {
  role       = aws_iam_role.iot_s3_role.name
  policy_arn = aws_iam_policy.iot_s3_policy.arn
}

# IAM policy that allows the ECS backend task role to generate pre-signed
# PutObject URLs for large payloads (>128 KB) uploaded directly to S3.
resource "aws_iam_policy" "backend_s3_presign" {
  name = "open_jii_${var.environment}_backend_iot_s3_presign"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject"]
      Resource = "${var.s3_archive_bucket_arn}/large-iot/*"
    }]
  })
}

# ---------------------------------------------------------------
# SQS queue + S3 event notifications for large-iot/ ingestion
# Only created when enable_large_iot_sqs = true (dev / prod).
# DR env skips this because it has no Databricks workspace.
# ---------------------------------------------------------------

resource "aws_sqs_queue" "large_iot_dlq" {
  count                     = var.enable_large_iot_sqs ? 1 : 0
  name                      = "open-jii-${var.environment}-large-iot-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "iot"
  }
}

resource "aws_sqs_queue" "large_iot_notifications" {
  count                      = var.enable_large_iot_sqs ? 1 : 0
  name                       = "open-jii-${var.environment}-large-iot-notifications"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 86400 # 1 day

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.large_iot_dlq[0].arn
    maxReceiveCount     = 3
  })

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "iot"
  }
}

resource "aws_sqs_queue_policy" "large_iot_notifications" {
  count     = var.enable_large_iot_sqs ? 1 : 0
  queue_url = aws_sqs_queue.large_iot_notifications[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowS3SendMessage"
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.large_iot_notifications[0].arn
      Condition = {
        ArnLike = {
          "aws:SourceArn" = var.s3_archive_bucket_arn
        }
      }
    }]
  })
}

resource "aws_s3_bucket_notification" "large_iot" {
  count  = var.enable_large_iot_sqs ? 1 : 0
  bucket = var.s3_archive_bucket_name

  queue {
    queue_arn     = aws_sqs_queue.large_iot_notifications[0].arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "large-iot/"
  }

  depends_on = [aws_sqs_queue_policy.large_iot_notifications]
}

# IAM policy allowing the Databricks storage-credential role to read large-iot
# objects from S3 and consume the SQS notification queue via Auto Loader.
resource "aws_iam_policy" "databricks_large_iot_read" {
  count = var.enable_large_iot_sqs ? 1 : 0
  name  = "open_jii_${var.environment}_databricks_large_iot_read"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "S3Read"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:ListBucket"]
        Resource = [
          "${var.s3_archive_bucket_arn}",
          "${var.s3_archive_bucket_arn}/large-iot/*"
        ]
      },
      {
        Sid    = "SQSConsume"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl"
        ]
        Resource = aws_sqs_queue.large_iot_notifications[0].arn
      }
    ]
  })
}

# CloudWatch alarms for queue health monitoring.
resource "aws_cloudwatch_metric_alarm" "large_iot_queue_depth" {
  count               = var.enable_large_iot_sqs ? 1 : 0
  alarm_name          = "open-jii-${var.environment}-large-iot-queue-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 1000
  alarm_description   = "Large IoT SQS queue depth is high — Auto Loader may be lagging"

  dimensions = {
    QueueName = aws_sqs_queue.large_iot_notifications[0].name
  }
}

resource "aws_cloudwatch_metric_alarm" "large_iot_dlq_depth" {
  count               = var.enable_large_iot_sqs ? 1 : 0
  alarm_name          = "open-jii-${var.environment}-large-iot-dlq-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Large IoT DLQ has messages — S3 notifications are failing to process"

  dimensions = {
    QueueName = aws_sqs_queue.large_iot_dlq[0].name
  }
}

# ----------------
# IoT Topic Rules
# ----------------
resource "aws_iot_topic_rule" "iot_rules" {
  for_each = local.asyncapi.channels

  name        = local.iot_rule_names[each.key]
  enabled     = true
  sql         = "SELECT topic() as topic, * FROM '${local.iot_topic_filters[each.key]}'"
  sql_version = "2016-03-23"

  kinesis {
    role_arn      = aws_iam_role.iot_kinesis_role.arn
    stream_name   = var.kinesis_stream_name
    partition_key = "$${newuuid()}"
  }

  s3 {
    role_arn    = aws_iam_role.iot_s3_role.arn
    bucket_name = var.s3_archive_bucket_name
    key         = "raw-iot/$${parse_time(\"yyyy/MM/dd\", timestamp())}/$${newuuid()}.json"
  }
}

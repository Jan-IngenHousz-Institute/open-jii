data "aws_caller_identity" "current" {}

locals {
  # Load the AsyncAPI YAML file.
  asyncapi = yamldecode(file("${path.module}/../../../asyncapi.yaml"))

  # Get all channel keys.
  all_channels = keys(local.asyncapi.channels)

  # Channel parameters bound to the connecting Cognito identity. In the policy
  # these render as the ${cognito-identity.amazonaws.com:sub} variable so a device
  # can only subscribe to / receive on its own topic, never another device's.
  identity_param_names = ["identityId"]

  # AsyncAPI operations are described from the server's perspective: a "subscribe"
  # op means devices publish (cloud-bound), "publish" means the cloud publishes and
  # devices receive. iot:Subscribe authorizes against a topicfilter/ ARN while
  # iot:Publish / iot:Receive use a topic/ ARN, so they become separate statements.
  topic_actions_by_channel = {
    for channel, details in local.asyncapi.channels : channel =>
    concat(
      contains(keys(details), "subscribe") ? ["iot:Publish"] : [],
      contains(keys(details), "publish") ? ["iot:Receive"] : []
    )
  }

  topicfilter_actions_by_channel = {
    for channel, details in local.asyncapi.channels : channel =>
    contains(keys(details), "publish") ? ["iot:Subscribe"] : []
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

  # Topic used in IoT policy resource ARNs: identity-bound parameters render as the
  # Cognito sub policy variable, every other parameter becomes a "*" wildcard.
  iot_policy_topics = {
    for channel in local.all_channels : channel =>
    join("/", [
      for segment in split("/", channel) :
      (startswith(segment, "{") && endswith(segment, "}")) ? (
        contains(local.identity_param_names, substr(segment, 1, length(segment) - 2))
        ? "$${cognito-identity.amazonaws.com:sub}"
        : "*"
      ) : segment
    ])
  }

  # Only cloud-bound (device-publish) channels are routed to Kinesis/S3. Outbound
  # channels (e.g. script delivery) must not be ingested back into the data lake.
  ingest_channels = {
    for channel, details in local.asyncapi.channels : channel => details
    if contains(keys(details), "subscribe")
  }

  # Friendly name per channel, derived from the channel's static prefix.
  iot_policy_names = {
    for channel in local.all_channels : channel =>
    "open_jii_${var.environment}_iot_policy_${replace(trim(split("/{", channel)[0], "/"), "/", "_")}"
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
# One IoT policy per channel. The backend attaches every policy to each
# authenticated Cognito identity, so adding a channel is additive: existing
# policies keep their name and address and are never replaced.
resource "aws_iot_policy" "iot_policy" {
  for_each = local.asyncapi.channels

  name = local.iot_policy_names[each.key]
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = concat(
      [
        {
          Effect   = "Allow",
          Action   = "iot:Connect",
          Resource = "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:client/$${iot:ClientId}"
        }
      ],
      length(local.topic_actions_by_channel[each.key]) > 0 ? [
        {
          Effect   = "Allow",
          Action   = local.topic_actions_by_channel[each.key],
          Resource = "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topic/${local.iot_policy_topics[each.key]}"
        }
      ] : [],
      length(local.topicfilter_actions_by_channel[each.key]) > 0 ? [
        {
          Effect   = "Allow",
          Action   = local.topicfilter_actions_by_channel[each.key],
          Resource = "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topicfilter/${local.iot_policy_topics[each.key]}"
        }
      ] : []
    )
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
      Resource = "${var.large_iot_bucket_arn}/*"
    }]
  })
}

resource "aws_sqs_queue" "large_iot_dlq" {
  count = var.enable_large_iot_sqs ? 1 : 0

  name                      = "open-jii-${var.environment}-large-iot-dlq"
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "large_iot_notifications" {
  count = var.enable_large_iot_sqs ? 1 : 0

  name                       = "open-jii-${var.environment}-large-iot-notifications"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 86400 # 1 day

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.large_iot_dlq[0].arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue_policy" "large_iot_notifications" {
  count = var.enable_large_iot_sqs ? 1 : 0

  queue_url = aws_sqs_queue.large_iot_notifications[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.large_iot_notifications[0].arn
      Condition = {
        ArnLike = { "aws:SourceArn" = var.large_iot_bucket_arn }
      }
    }]
  })
}

resource "aws_s3_bucket_notification" "large_iot" {
  count = var.enable_large_iot_sqs ? 1 : 0

  bucket = var.large_iot_bucket_name

  queue {
    queue_arn     = aws_sqs_queue.large_iot_notifications[0].arn
    events        = ["s3:ObjectCreated:*"]
    filter_suffix = ".json"
  }

  depends_on = [aws_sqs_queue_policy.large_iot_notifications]
}

resource "aws_iam_policy" "databricks_large_iot_read" {
  count = var.enable_large_iot_sqs ? 1 : 0

  name = "open_jii_${var.environment}_databricks_large_iot_read"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:ListBucket"]
        Resource = [var.large_iot_bucket_arn, "${var.large_iot_bucket_arn}/*"]
      },
      {
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

# ----------------
# IoT Topic Rules
# ----------------
resource "aws_iot_topic_rule" "iot_rules" {
  for_each = local.ingest_channels

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

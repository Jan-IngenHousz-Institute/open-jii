data "aws_caller_identity" "current" {}

locals {
  # Load the AsyncAPI YAML file.
  asyncapi = yamldecode(file("${path.module}/../../../asyncapi.yaml"))

  # Get all channel keys.
  all_channels = keys(local.asyncapi.channels)

  # Channel parameters bound to the connecting device's identity. In the policy
  # these render as the ${iot:Connection.Thing.ThingName} variable so a device
  # (authenticated by its X.509 certificate attached to that Thing) can only
  # subscribe to / receive on its own topic, never another device's. Devices must
  # connect with clientId == Thing name for the variable to resolve.
  identity_param_names = ["thingName"]

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

  # Friendly name per channel: the static topic prefix, unless the channel sets
  # x-infra-name (needed when two channels share a prefix, e.g. the lean and
  # legacy ingest shapes). Existing channels must never change names: policies
  # are attached to live certificates.
  iot_infra_names = {
    for channel, details in local.asyncapi.channels : channel =>
    lookup(details, "x-infra-name", replace(trim(split("/{", channel)[0], "/"), "/", "_"))
  }

  iot_rule_names = {
    for channel in local.all_channels : channel =>
    "open_jii_${var.environment}_iot_rule_${local.iot_infra_names[channel]}"
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
  # Thing-name policy variable, every other parameter becomes a "*" wildcard.
  iot_policy_topics = {
    for channel in local.all_channels : channel =>
    join("/", [
      for segment in split("/", channel) :
      (startswith(segment, "{") && endswith(segment, "}")) ? (
        contains(local.identity_param_names, substr(segment, 1, length(segment) - 2))
        ? "$${iot:Connection.Thing.ThingName}"
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

  iot_policy_names = {
    for channel in local.all_channels : channel =>
    "open_jii_${var.environment}_iot_policy_${local.iot_infra_names[channel]}"
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

# ------------------------------------------------------------------
# AWS IoT Jobs (firmware delivery)
# ------------------------------------------------------------------
# Hand-written rather than derived from asyncapi.yaml: that file is our own
# message contract, while `$aws/*` is AWS's reserved namespace with a fixed
# shape. Every statement is scoped by the thing policy variable, so a device
# can only read and update the job executions addressed to itself.
# https://docs.aws.amazon.com/iot/latest/developerguide/iot-data-plane-jobs.html
locals {
  jobs_thing_topic = "$${iot:Connection.Thing.ThingName}/jobs"

  # notify-next carries the next queued execution; $next/get and +/update are
  # request/response pairs, so the device also needs their accepted/rejected
  # replies (the trailing +).
  jobs_subscribe_topics = [
    "${local.jobs_thing_topic}/notify-next",
    "${local.jobs_thing_topic}/$next/get/+",
    "${local.jobs_thing_topic}/+/update/+",
  ]

  jobs_publish_topics = [
    "${local.jobs_thing_topic}/$next/get",
    "${local.jobs_thing_topic}/+/update",
  ]
}

resource "aws_iot_policy" "jobs" {
  name = "open_jii_${var.environment}_iot_policy_jobs"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "iot:Connect",
        Resource = "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:client/$${iot:Connection.Thing.ThingName}"
      },
      {
        Effect = "Allow",
        Action = "iot:Subscribe",
        Resource = [
          for topic in local.jobs_subscribe_topics :
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topicfilter/$aws/things/${topic}"
        ]
      },
      {
        Effect = "Allow",
        Action = "iot:Receive",
        Resource = [
          for topic in local.jobs_subscribe_topics :
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topic/$aws/things/${topic}"
        ]
      },
      {
        Effect = "Allow",
        Action = "iot:Publish",
        Resource = [
          for topic in local.jobs_publish_topics :
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topic/$aws/things/${topic}"
        ]
      }
    ]
  })
}

# Lets AWS IoT presign the firmware object when it substitutes the job
# document's `${aws:iot:s3-presigned-url:...}` placeholder at delivery time.
# https://docs.aws.amazon.com/iot/latest/apireference/API_PresignedUrlConfig.html
# count keys off a static flag, never off firmware_bucket_arn: on a first apply
# the bucket does not exist yet, so its ARN is unknown at plan time and cannot
# decide how many instances to create.
resource "aws_iam_role" "jobs_presign" {
  count = var.enable_firmware_jobs ? 1 : 0

  name = "open_jii_${var.environment}_iot_jobs_presign"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "iot.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "jobs_presign" {
  count = var.enable_firmware_jobs ? 1 : 0

  name = "open_jii_${var.environment}_iot_jobs_presign"
  role = aws_iam_role.jobs_presign[0].id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow",
      Action   = "s3:GetObject",
      Resource = "${var.firmware_bucket_arn}/*"
    }]
  })
}

# --------------------------------------------------
# Managed device registry (Thing type + group)
# --------------------------------------------------
# Devices registered through the platform are created as Things of this type and
# added to the managed-devices group. Certificates and their scoped policy are
# attached in a later slice; nothing here issues credentials.
resource "aws_iot_thing_type" "device" {
  name = "open_jii_${var.environment}_device"

  properties {
    description           = "Platform-managed IoT device"
    searchable_attributes = ["deviceType", "serialNumber"]
  }
}

resource "aws_iot_thing_group" "managed_devices" {
  name = "open_jii_${var.environment}_managed_devices"

  properties {
    description = "All platform-registered IoT devices"
  }
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
      Resource = "${var.s3_archive_bucket_arn}/device-lifecycle-events/*"
    }]
  })

  # Narrow only after the ingest rules stop writing raw-iot/*, so in-flight
  # archive writes are never denied while the old S3 action is still live.
  depends_on = [aws_iot_topic_rule.iot_rules]
}

resource "aws_iam_role_policy_attachment" "iot_s3_attach" {
  role       = aws_iam_role.iot_s3_role.name
  policy_arn = aws_iam_policy.iot_s3_policy.arn
}

# --------------------------------------------------
# IAM Role and Policy for Firehose raw archive
# --------------------------------------------------
resource "aws_iam_role" "iot_firehose_role" {
  name = var.iot_firehose_role_name
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "iot.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_policy" "iot_firehose_policy" {
  name = var.iot_firehose_policy_name
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow",
      Action   = ["firehose:PutRecord", "firehose:PutRecordBatch"],
      Resource = var.firehose_delivery_stream_arn
    }]
  })
}

resource "aws_iam_role_policy_attachment" "iot_firehose_attach" {
  role       = aws_iam_role.iot_firehose_role.name
  policy_arn = aws_iam_policy.iot_firehose_policy.arn
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

# IAM policy granting the Databricks storage-credential role read access to the
# large-iot bucket so the DLT pipeline can ingest payloads via Auto Loader.
# Gated on the bucket ARN so environments without a large-iot bucket (DR)
# don't render an invalid empty Resource.
resource "aws_iam_policy" "databricks_large_iot_read" {
  count = var.large_iot_bucket_arn != "" ? 1 : 0

  name = "open_jii_${var.environment}_databricks_large_iot_read"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:ListBucket"]
        Resource = [var.large_iot_bucket_arn, "${var.large_iot_bucket_arn}/*"]
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
  sql         = "SELECT topic() as topic, clientid() as client_id, * FROM '${local.iot_topic_filters[each.key]}'"
  sql_version = "2016-03-23"

  kinesis {
    role_arn      = aws_iam_role.iot_kinesis_role.arn
    stream_name   = var.kinesis_stream_name
    partition_key = "$${newuuid()}"
  }

  # Raw archive goes through Firehose so messages are buffered into large
  # objects instead of one S3 PUT per message.
  firehose {
    role_arn             = aws_iam_role.iot_firehose_role.arn
    delivery_stream_name = var.firehose_delivery_stream_name
    separator            = "\n"
  }
}

# --------------------------------------------------
# Device connectivity: lifecycle events + fleet index
# --------------------------------------------------
# Presence lifecycle events ($aws/events/presence/...) are archived to S3 only.
# They must never reach the Kinesis measurement stream: bronze consumes the
# whole stream unconditionally and is non-resettable.
resource "aws_iot_topic_rule" "device_lifecycle_events" {
  name        = "open_jii_${var.environment}_iot_rule_device_lifecycle_events"
  enabled     = true
  sql         = "SELECT *, topic() as topic FROM '$aws/events/presence/#'"
  sql_version = "2016-03-23"

  s3 {
    role_arn    = aws_iam_role.iot_s3_role.arn
    bucket_name = var.s3_archive_bucket_name
    key         = "device-lifecycle-events/$${parse_time(\"yyyy/MM/dd\", timestamp())}/$${newuuid()}.json"
  }
}

# Account/region singleton: dev and prod live in separate accounts, but the
# variable gate keeps additional environments in a shared account safe.
resource "aws_iot_indexing_configuration" "fleet_indexing" {
  count = var.enable_fleet_indexing ? 1 : 0

  thing_indexing_configuration {
    thing_indexing_mode              = "REGISTRY"
    thing_connectivity_indexing_mode = "STATUS"
  }
}

# Read access for the Databricks storage-credential role to the device-lifecycle-events
# prefix of the raw archive (Auto Loader source for connectivity history).
resource "aws_iam_policy" "databricks_device_lifecycle_read" {
  count = var.enable_databricks_lifecycle_read ? 1 : 0

  name = "open_jii_${var.environment}_databricks_device_lifecycle_read"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Resource = [
          # S3A HEADs the bare prefix key first; denied it gets a fatal 403
          # where a permitted probe gets a harmless 404.
          "${var.s3_archive_bucket_arn}/device-lifecycle-events",
          "${var.s3_archive_bucket_arn}/device-lifecycle-events/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = var.s3_archive_bucket_arn
        # Scoped to this prefix: the archive also holds raw measurement
        # payloads. Both slash forms, because the probe tries both.
        Condition = {
          StringLike = {
            "s3:prefix" = [
              "device-lifecycle-events",
              "device-lifecycle-events/",
              "device-lifecycle-events/*",
            ]
          }
        }
      }
    ]
  })
}

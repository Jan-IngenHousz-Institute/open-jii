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

# -----------------------------------------------
# IAM Role and Policy for Timestream Integration
# -----------------------------------------------
resource "aws_iam_role" "iot_timestream_role" {
  name = var.iot_timestream_role_name
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "iot.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_policy" "iot_timestream_policy" {
  name = var.iot_timestream_policy_name
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Action = [
        "timestream:WriteRecords",
        "timestream:DescribeEndpoints"
      ],
      Resource = "*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "iot_timestream_attach" {
  role       = aws_iam_role.iot_timestream_role.name
  policy_arn = aws_iam_policy.iot_timestream_policy.arn
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

# ----------------
# IoT Topic Rules
# ----------------
resource "aws_iot_topic_rule" "iot_rules" {
  for_each = local.asyncapi.channels

  name        = local.iot_rule_names[each.key]
  enabled     = true
  sql         = "SELECT topic() as topic, * FROM '${local.iot_topic_filters[each.key]}'"
  sql_version = "2016-03-23"

  timestream {
    role_arn      = aws_iam_role.iot_timestream_role.arn
    database_name = var.timestream_database
    table_name    = var.timestream_table

    dynamic "dimension" {
      for_each = local.iot_parameter_to_topic_index[each.key]
      content {
        name  = dimension.key
        value = format("$${topic(%d)}", dimension.value)
      }
    }
  }

  kinesis {
    role_arn      = aws_iam_role.iot_kinesis_role.arn
    stream_name   = var.kinesis_stream_name
    partition_key = "$${newuuid()}"
  }
}

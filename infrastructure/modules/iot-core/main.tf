locals {
  asyncapi = yamldecode(file("${path.module}/../../../asyncapi.yaml"))
}

# --------------------------
# IoT Policy
# --------------------------
resource "aws_iot_policy" "iot_policy" {
  name   = var.policy_name
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "iot:Connect",
        "iot:Publish",
        "iot:Subscribe",
        "iot:Receive"
      ],
      "Effect": "Allow",
      "Resource": "*"
    }
  ]
}
EOF
}

# --------------------------
# IAM Role for Timestream
# --------------------------
resource "aws_iam_role" "iot_timestream_role" {
  name = var.iot_timestream_role_name
  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [{
      "Effect" : "Allow",
      "Principal" : { "Service" : "iot.amazonaws.com" },
      "Action" : "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_policy" "iot_timestream_policy" {
  name = var.iot_timestream_policy_name
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [{
      "Effect" : "Allow",
      "Action" : [
        "timestream:WriteRecords",
        "timestream:DescribeEndpoints"
      ],
      "Resource" : "*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "iot_timestream_attach" {
  role       = aws_iam_role.iot_timestream_role.name
  policy_arn = aws_iam_policy.iot_timestream_policy.arn
}

# --------------------------
# IAM Role for Kinesis
# --------------------------
resource "aws_iam_role" "iot_kinesis_role" {
  name = var.iot_kinesis_role_name
  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [{
      "Effect" : "Allow",
      "Principal" : { "Service" : "iot.amazonaws.com" },
      "Action" : "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_policy" "iot_kinesis_policy" {
  name = var.iot_kinesis_policy_name
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [{
      "Effect" : "Allow",
      "Action" : [
        "kinesis:PutRecord",
        "kinesis:PutRecords"
      ],
      "Resource" : var.kinesis_stream_arn
    }]
  })
}

resource "aws_iam_role_policy_attachment" "iot_kinesis_attach" {
  role       = aws_iam_role.iot_kinesis_role.name
  policy_arn = aws_iam_policy.iot_kinesis_policy.arn
}

# --------------------------
# IoT Topic Rules
# --------------------------
resource "aws_iot_topic_rule" "iot_rules" {
  for_each = { for k, v in local.asyncapi["channels"] : k => v }

  name        = replace(replace(replace(each.key, "/", "_"), "{", ""), "}", "")
  enabled     = true
  sql         = "SELECT * FROM '${each.key}'"
  sql_version = "2016-03-23"

  timestream {
    role_arn      = aws_iam_role.iot_timestream_role.arn
    database_name = var.timestream_database
    table_name    = var.timestream_table

    dimension {
      name  = "deviceId"
      value = "$${topic(2)}"
    }
  }

  kinesis {
    role_arn      = aws_iam_role.iot_kinesis_role.arn
    stream_name   = var.kinesis_stream_name
    partition_key = "$${newuuid()}"
  }
}

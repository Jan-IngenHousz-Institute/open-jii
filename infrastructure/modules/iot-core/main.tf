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
# Timestream Integration
# --------------------------

resource "aws_iam_role" "iot_timestream_role" {
  name = var.iot_timestream_role_name
  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "iot.amazonaws.com"
        },
        "Action" : "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_policy" "iot_timestream_policy" {
  name = var.iot_timestream_policy_name
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Action" : [
          "timestream:WriteRecords",
          "timestream:DescribeEndpoints"
        ],
        "Resource" : "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "iot_timestream_attach" {
  role       = aws_iam_role.iot_timestream_role.name
  policy_arn = aws_iam_policy.iot_timestream_policy.arn
}

# --------------------------
# Kinesis Integration
# --------------------------

resource "aws_iam_role" "iot_kinesis_role" {
  name = var.iot_kinesis_role_name
  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "iot.amazonaws.com"
        },
        "Action" : "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_policy" "iot_kinesis_policy" {
  name = var.iot_kinesis_policy_name
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Action" : [
          "kinesis:PutRecord",
          "kinesis:PutRecords"
        ],
        "Resource" : var.kinesis_stream_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "iot_kinesis_attach" {
  role       = aws_iam_role.iot_kinesis_role.name
  policy_arn = aws_iam_policy.iot_kinesis_policy.arn
}

# --------------------------
# IoT Topic Rule with Dual Actions
# --------------------------

resource "aws_iot_topic_rule" "iot_rule" {
  name        = var.rule_name
  enabled     = true
  sql         = "SELECT * FROM '${var.topic_filter}'"
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

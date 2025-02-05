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

# Create an IoT topic rule that sends data to Timestream.
# This rule listens for messages matching the topic filter (e.g. "sensors/+/data"),
# writes the data into the Timestream table defined in var.timestream_table,
# and sets the "deviceId" dimension by extracting the second segment of the topic.
resource "aws_iot_topic_rule" "timestream_rule" {
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
}

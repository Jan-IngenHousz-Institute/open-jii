data "aws_partition" "current" {}
data "aws_caller_identity" "current" {}

resource "aws_iam_role" "iot_cloudwatch_role" {
  name = var.cloudwatch_role_name
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "iot.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_policy" "iot_cloudwatch_policy" {
  name = var.cloudwatch_policy_name
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:PutMetricFilter",
          "logs:PutRetentionPolicy",
          "iot:GetLoggingOptions",
          "iot:SetLoggingOptions",
          "iot:SetV2LoggingOptions",
          "iot:GetV2LoggingOptions",
          "iot:SetV2LoggingLevel",
          "iot:ListV2LoggingLevels",
          "iot:DeleteV2LoggingLevel"
        ],
        Resource = [
          "arn:${data.aws_partition.current.partition}:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:AWSIotLogsV2:*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "iot_cloudwatch_attach" {
  role       = aws_iam_role.iot_cloudwatch_role.name
  policy_arn = aws_iam_policy.iot_cloudwatch_policy.arn
}

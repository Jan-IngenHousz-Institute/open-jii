resource "aws_kinesis_stream" "this" {
  name             = var.stream_name
  shard_count      = var.shard_count
  retention_period = var.retention_period_hours
}

data "aws_caller_identity" "current" {}

# Create IAM role for Unity Catalog to assume
resource "aws_iam_role" "unity_catalog_kinesis_role" {
  name = var.role_name

  # Trust policy - allows Databricks Unity Catalog to assume this role
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = {
        AWS = var.databricks_unity_catalog_role_arn
      },
      Action = "sts:AssumeRole",
      Condition = {
        StringEquals = {
          "sts:ExternalId" = "0000"
        }
      }
    }]
  })
}

# Create IAM policy for Kinesis access
resource "aws_iam_policy" "kinesis_access_policy" {
  name        = var.policy_name
  description = "Policy for accessing Kinesis streams from Databricks"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "kinesis:GetRecords",
          "kinesis:GetShardIterator",
          "kinesis:DescribeStream",
          "kinesis:DescribeStreamSummary",
          "kinesis:ListShards",
          "kinesis:ListStreams",
          "kinesis:ListStreamConsumers",
          "kinesis:RegisterStreamConsumer",
          "kinesis:SubscribeToShard"
        ],
        Resource = [
          aws_kinesis_stream.this.arn,
          "${aws_kinesis_stream.this.arn}/*"
        ]
      },
      {
        Effect = "Allow",
        Action = [
          "sts:AssumeRole"
        ],
        Resource = [
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.role_name}"
        ]
      }
    ]
  })

  depends_on = [aws_kinesis_stream.this]
}

# Attach Kinesis policy to the role
resource "aws_iam_role_policy_attachment" "kinesis_access_attachment" {
  role       = aws_iam_role.unity_catalog_kinesis_role.name
  policy_arn = aws_iam_policy.kinesis_access_policy.arn
}

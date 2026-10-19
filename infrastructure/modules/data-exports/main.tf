# Lets the Unity Catalog storage-credential role write export files through the
# exports volume; attach the ARN to that credential's additional_policy_arns
resource "aws_iam_policy" "databricks_write" {
  name = "open_jii_${var.environment}_databricks_data_exports_write"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = [var.bucket_arn, "${var.bucket_arn}/*"]
      }
    ]
  })
}

# Lets the backend ECS task role read manifests and sign GetObject URLs for
# export parts, so downloads go straight from S3 to the browser
resource "aws_iam_policy" "backend_read" {
  name = "open_jii_${var.environment}_backend_data_exports_read"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${var.bucket_arn}/*"
      }
    ]
  })
}

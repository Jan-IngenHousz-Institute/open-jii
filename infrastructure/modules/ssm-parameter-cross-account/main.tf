# SSM Parameter with cross-account access policy
# This module creates an SSM parameter and grants read access to a trusted account

resource "aws_ssm_parameter" "parameter" {
  name        = var.parameter_name
  description = var.description
  type        = var.parameter_type
  value       = var.parameter_value
  tier        = var.tier

  tags = merge(
    {
      Name              = var.parameter_name
      ManagedBy         = "Terraform"
      CrossAccountShare = "true"
    },
    var.tags
  )
}

# IAM policy to allow the trusted account to read this parameter
resource "aws_iam_policy" "cross_account_read" {
  name        = "${var.parameter_name_prefix}-CrossAccountRead"
  description = "Allow trusted account to read SSM parameter ${var.parameter_name}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = aws_ssm_parameter.parameter.arn
      }
    ]
  })

  tags = var.tags
}

# IAM role that the trusted account can assume to read the parameter
resource "aws_iam_role" "cross_account_reader" {
  name        = "${var.parameter_name_prefix}-CrossAccountReader"
  description = "Role for trusted account to read SSM parameter ${var.parameter_name}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      merge(
        {
          Effect = "Allow"
          Principal = {
            AWS = var.trusted_principals
          }
          Action = "sts:AssumeRole"
        },
        var.external_id != "" ? {
          Condition = {
            StringEquals = {
              "sts:ExternalId" = var.external_id
            }
          }
        } : {}
      )
    ]
  })

  tags = var.tags
}

# Attach the read policy to the role
resource "aws_iam_role_policy_attachment" "cross_account_reader" {
  role       = aws_iam_role.cross_account_reader.name
  policy_arn = aws_iam_policy.cross_account_read.arn
}

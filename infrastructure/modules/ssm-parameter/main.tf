# SSM Parameter that can be accessed cross-account via resource-based policy
# This module creates an SSM parameter with a resource policy allowing cross-account access

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

# Resource-based policy for the SSM parameter to allow cross-account access
resource "aws_ssm_parameter_policy" "cross_account_policy" {
  count          = length(var.cross_account_allowlist) > 0 ? 1 : 0
  parameter_name = aws_ssm_parameter.parameter.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCrossAccountAccess"
        Effect = "Allow"
        Principal = {
          AWS = [
            for account_id in var.cross_account_allowlist : 
            "arn:aws:iam::${account_id}:root"
          ]
        }
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = aws_ssm_parameter.parameter.arn
      }
    ]
  })
}

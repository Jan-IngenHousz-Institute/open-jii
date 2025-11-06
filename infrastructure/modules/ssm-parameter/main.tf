# SSM Parameter
# This module creates an SSM parameter that can be read by any principal with appropriate IAM permissions

resource "aws_ssm_parameter" "parameter" {
  name        = var.parameter_name
  description = var.description
  type        = var.parameter_type
  value       = var.parameter_value
  tier        = var.tier

  tags = merge(
    {
      Name      = var.parameter_name
      ManagedBy = "Terraform"
    },
    var.tags
  )
}

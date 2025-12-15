# SSM Parameter
# This module creates an SSM parameter that can be read by any principal with appropriate IAM permissions

resource "aws_ssm_parameter" "parameter" {
  for_each = var.parameters

  name        = each.value.name
  description = each.value.description
  type        = each.value.type
  value       = each.value.value
  tier        = each.value.tier

  tags = var.tags
}

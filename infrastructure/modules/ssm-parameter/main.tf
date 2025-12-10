# SSM Parameter
# This module creates an SSM parameter that can be read by any principal with appropriate IAM permissions

resource "aws_ssm_parameter" "parameter" {
  for_each = var.parameters

  name        = each.value.name
  description = lookup(each.value, "description", "")
  type        = lookup(each.value, "type", "String")
  value       = each.value.value
  tier        = lookup(each.value, "tier", "Standard")

  tags = var.tags
}

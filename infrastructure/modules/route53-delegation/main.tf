# Validation: Ensure exactly one method is provided
locals {
  has_name_servers     = var.name_servers != null
  has_ssm_config       = var.ssm_parameter_config != null
  exactly_one_provided = (local.has_name_servers && !local.has_ssm_config) || (!local.has_name_servers && local.has_ssm_config)

  # Will cause an error if validation fails
  validate_inputs = local.exactly_one_provided ? true : tobool("ERROR: Either name_servers or ssm_parameter_config must be provided (but not both)")
}

# Configure provider for cross-account SSM access (if needed)
provider "aws" {
  alias  = "source_account"
  region = var.ssm_parameter_config != null ? var.ssm_parameter_config.aws_region : "us-east-1"

  dynamic "assume_role" {
    for_each = var.ssm_parameter_config != null ? [1] : []
    content {
      role_arn = "arn:aws:iam::${var.ssm_parameter_config.source_account_id}:role/${var.ssm_parameter_config.assume_role_name}"
    }
  }
}

# Read nameservers from SSM Parameter Store (if configured)
data "aws_ssm_parameter" "nameservers" {
  count    = var.ssm_parameter_config != null ? 1 : 0
  provider = aws.source_account
  name     = var.ssm_parameter_config.parameter_name
}

# Local value to determine which nameservers to use
locals {
  nameservers = var.name_servers != null ? var.name_servers : (
    var.ssm_parameter_config != null ? split(",", data.aws_ssm_parameter.nameservers[0].value) : []
  )
}

# Create NS delegation record in parent zone
resource "aws_route53_record" "delegation" {
  zone_id = var.parent_zone_id
  name    = var.subdomain
  type    = "NS"
  ttl     = 172800
  records = local.nameservers
}

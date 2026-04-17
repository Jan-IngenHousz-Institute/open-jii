# ============================================================================
# Distributed Load Testing on AWS — managed via OpenTofu
#
# Uses the official AWS Solutions CloudFormation template so there is nothing
# to build or package locally. OpenTofu owns the stack lifecycle (create /
# update / destroy) and exposes the stack outputs as Tofu outputs.
#
# Official template URL (always latest stable release):
#   https://solutions-reference.s3.amazonaws.com/distributed-load-testing-on-aws/latest/distributed-load-testing-on-aws.template
#
# Docs:  https://docs.aws.amazon.com/solutions/distributed-load-testing-on-aws/
# Repo:  https://github.com/aws-solutions/distributed-load-testing-on-aws
# ============================================================================

locals {
  # When existing_vpc_id is empty, DLT creates its own isolated VPC.
  # When provided, it must come with both subnet IDs.
  using_existing_vpc = var.existing_vpc_id != ""

  tags = {
    Project     = "open-jii"
    Component   = "load-testing"
    ManagedBy   = "OpenTofu"
  }
}

resource "aws_cloudformation_stack" "dlt" {
  name         = var.stack_name
  template_url = "https://solutions-reference.s3.amazonaws.com/distributed-load-testing-on-aws/latest/distributed-load-testing-on-aws.template"

  # Stack-level capabilities required by the DLT template (IAM roles, named resources)
  capabilities = ["CAPABILITY_IAM", "CAPABILITY_NAMED_IAM", "CAPABILITY_AUTO_EXPAND"]

  parameters = {
    # ── Admin ──────────────────────────────────────────────────────────────
    AdminName  = var.admin_name
    AdminEmail = var.admin_email

    # ── VPC ────────────────────────────────────────────────────────────────
    # When ExistingVPCId is empty the template creates a new VPC using the
    # CIDR blocks below. Both paths are wired here so you can switch without
    # changing the resource block.
    ExistingVPCId     = var.existing_vpc_id
    ExistingSubnetA   = var.existing_subnet_a
    ExistingSubnetB   = var.existing_subnet_b
    VpcCidrBlock      = var.vpc_cidr_block
    SubnetACidrBlock  = var.subnet_a_cidr_block
    SubnetBCidrBlock  = var.subnet_b_cidr_block

    # ── Fargate egress ─────────────────────────────────────────────────────
    # Controls outbound traffic from load-test containers.
    # Keep 0.0.0.0/0 so containers can reach your CloudFront/ALB endpoints.
    EgressCidr = var.egress_cidr_block

    # ── Container image ─────────────────────────────────────────────────────
    # "Yes" = vX.Y_stable tag (recommended); "No" = exact version tag
    UseStableTagging = var.use_stable_tagging
  }

  # Propagate tags to all CloudFormation-managed resources that support tagging
  tags = local.tags

  # DLT stack takes ~10-15 min to create (Cognito, CloudFront, ECS cluster …)
  timeouts {
    create = "30m"
    update = "30m"
    delete = "30m"
  }
}

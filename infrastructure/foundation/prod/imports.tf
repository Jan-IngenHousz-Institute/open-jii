# Adopts what the prod root created before this root existed, and the foundation role an admin
# created by hand. Delete this file once the first apply has run.

data "aws_caller_identity" "current" {}

locals {
  account_id   = data.aws_caller_identity.current.account_id
  state_bucket = "open-jii-terraform-state-${var.environment}"
  # modules/iam-oidc splits the deploy role's 39 service statements into 10 managed policies.
  deploy_policy_parts = toset([for i in range(1, 11) : tostring(i)])
}

import {
  to = module.terraform_state_s3.aws_s3_bucket.bucket
  id = local.state_bucket
}

import {
  to = module.terraform_state_s3.aws_s3_bucket_versioning.versioning
  id = local.state_bucket
}

import {
  to = module.terraform_state_s3.aws_s3_bucket_ownership_controls.ownership
  id = local.state_bucket
}

import {
  to = module.terraform_state_s3.aws_s3_bucket_acl.acl
  id = "${local.state_bucket},private"
}

import {
  to = module.terraform_state_s3.aws_s3_bucket_server_side_encryption_configuration.encryption
  id = local.state_bucket
}

import {
  to = module.terraform_state_s3.aws_s3_bucket_public_access_block.block
  id = local.state_bucket
}

import {
  to = module.terraform_state_s3.aws_s3_bucket_lifecycle_configuration.lifecycle[0]
  id = local.state_bucket
}

import {
  to = module.terraform_state_lock.aws_dynamodb_table.lock_table
  id = "terraform-state-lock"
}

import {
  to = module.iam_oidc.aws_iam_openid_connect_provider.github
  id = "arn:aws:iam::${local.account_id}:oidc-provider/token.actions.githubusercontent.com"
}

import {
  to = module.iam_oidc.aws_iam_role.oidc_role
  id = "GithubActionsDeployAccess"
}

import {
  for_each = local.deploy_policy_parts
  to       = module.iam_oidc.aws_iam_policy.oidc_role_policies[each.key]
  id       = "arn:aws:iam::${local.account_id}:policy/GithubActionsDeployAccessPolicy${each.key}"
}

import {
  for_each = local.deploy_policy_parts
  to       = module.iam_oidc.aws_iam_role_policy_attachment.oidc_role_policy_attachments[each.key]
  id       = "GithubActionsDeployAccess/arn:aws:iam::${local.account_id}:policy/GithubActionsDeployAccessPolicy${each.key}"
}

import {
  to = module.iam_oidc.aws_iam_role.plan_role[0]
  id = "GithubActionsPlanAccess"
}

import {
  to = module.iam_oidc.aws_iam_role_policy_attachment.plan_role_read_only[0]
  id = "GithubActionsPlanAccess/arn:aws:iam::aws:policy/ReadOnlyAccess"
}

import {
  to = module.iam_oidc.aws_iam_role_policy.plan_role_reads[0]
  id = "GithubActionsPlanAccess:GithubActionsPlanAccessReads"
}

import {
  to = module.iam_oidc.aws_iam_role.foundation_role[0]
  id = "GithubActionsFoundationAccess"
}

import {
  to = module.iam_oidc.aws_iam_role_policy.foundation_role[0]
  id = "GithubActionsFoundationAccess:GithubActionsFoundationAccessPolicy"
}

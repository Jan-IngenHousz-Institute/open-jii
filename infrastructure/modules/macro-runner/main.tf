locals {
  common_tags = merge(var.tags, {
    Component = "macro-runner"
  })
}

module "ecr" {
  source   = "../ecr"
  for_each = var.languages

  aws_region           = var.aws_region
  environment          = var.environment
  repository_name      = "macro-runner-${each.key}-${var.environment}"
  service_name         = "macro-runner-${each.key}"
  image_tag_mutability = var.image_tag_mutability
  force_delete         = var.force_delete

  create_repository_policy = false
  ci_cd_role_arn           = var.ci_cd_role_arn

  tags = merge(local.common_tags, {
    Language = each.key
  })
}

module "flow_logs" {
  source = "../vpc-flow-logs"

  name_prefix       = "macro-runner"
  environment       = var.environment
  subnet_ids        = var.isolated_subnet_ids
  retention_in_days = var.flow_log_retention_days

  tags = local.common_tags
}

module "lambda" {
  source = "../macro-lambda"

  environment         = var.environment
  isolated_subnet_ids = var.isolated_subnet_ids
  lambda_sg_id        = var.lambda_sg_id

  languages = {
    for k, v in var.languages : k => {
      memory             = v.memory
      timeout            = v.timeout
      ecr_repository_url = module.ecr[k].repository_url
      ecr_repository_arn = module.ecr[k].repository_arn
    }
  }

  flow_log_group_name = module.flow_logs.log_group_name
  log_retention_days  = var.log_retention_days

  tags = var.tags
}

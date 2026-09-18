locals {
  common_tags = merge(var.tags, {
    Component = "calibration-sandbox"
  })
}

module "ecr" {
  source = "../ecr"

  aws_region           = var.aws_region
  environment          = var.environment
  repository_name      = "calibration-sandbox-${var.environment}"
  service_name         = "calibration-sandbox"
  image_tag_mutability = var.image_tag_mutability
  force_delete         = var.force_delete

  create_repository_policy     = true
  create_ecs_pull_statement    = false
  create_lambda_pull_statement = true
  ci_cd_role_arn               = var.ci_cd_role_arn

  tags = local.common_tags
}

module "flow_logs" {
  source = "../vpc-flow-logs"

  name_prefix       = "calibration-sandbox"
  environment       = var.environment
  subnet_ids        = var.isolated_subnet_ids
  retention_in_days = var.flow_log_retention_days

  tags = local.common_tags
}

module "lambda" {
  source = "../calibration-lambda"

  environment         = var.environment
  isolated_subnet_ids = var.isolated_subnet_ids
  lambda_sg_id        = var.lambda_sg_id

  ecr_repository_url = module.ecr.repository_url
  ecr_repository_arn = module.ecr.repository_arn

  memory  = var.memory
  timeout = var.timeout

  flow_log_group_name = module.flow_logs.log_group_name
  log_retention_days  = var.log_retention_days

  reserved_concurrent_executions = var.reserved_concurrent_executions

  tags = local.common_tags
}

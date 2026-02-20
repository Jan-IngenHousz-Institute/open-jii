# ============================================================
# Macro Runner — Lambda-based isolated code execution
# ============================================================
# Composes three sub-modules:
#   1. ECR   (×3)  — container image registries per language
#   2. VPC Flow Logs — subnet-level traffic auditing
#   3. Macro Lambda  — IAM, SG, Lambda functions, alarms
# ============================================================

locals {
  languages = {
    python = { service_name = "macro-runner-python", label = "python" }
    js     = { service_name = "macro-runner-js", label = "javascript" }
    r      = { service_name = "macro-runner-r", label = "r" }
  }

  common_tags = merge(var.tags, {
    Component = "macro-runner"
  })
}

# ---- ECR repositories (one per language) --------------------

module "ecr_python" {
  source = "../ecr"

  aws_region           = var.aws_region
  environment          = var.environment
  repository_name      = "macro-runner-python-${var.environment}"
  service_name         = local.languages.python.service_name
  image_tag_mutability = var.image_tag_mutability
  force_delete         = var.force_delete

  create_repository_policy = false # Lambda uses IAM role auth, not repo policy
  ci_cd_role_arn           = var.ci_cd_role_arn

  tags = merge(local.common_tags, {
    Language = "python"
  })
}

module "ecr_js" {
  source = "../ecr"

  aws_region           = var.aws_region
  environment          = var.environment
  repository_name      = "macro-runner-js-${var.environment}"
  service_name         = local.languages.js.service_name
  image_tag_mutability = var.image_tag_mutability
  force_delete         = var.force_delete

  create_repository_policy = false
  ci_cd_role_arn           = var.ci_cd_role_arn

  tags = merge(local.common_tags, {
    Language = "javascript"
  })
}

module "ecr_r" {
  source = "../ecr"

  aws_region           = var.aws_region
  environment          = var.environment
  repository_name      = "macro-runner-r-${var.environment}"
  service_name         = local.languages.r.service_name
  image_tag_mutability = var.image_tag_mutability
  force_delete         = var.force_delete

  create_repository_policy = false
  ci_cd_role_arn           = var.ci_cd_role_arn

  tags = merge(local.common_tags, {
    Language = "r"
  })
}

# ---- VPC Flow Logs for isolated subnets --------------------

module "flow_logs" {
  source = "../vpc-flow-logs"

  name_prefix       = "macro-runner"
  environment       = var.environment
  subnet_ids        = var.isolated_subnet_ids
  retention_in_days = var.flow_log_retention_days

  tags = local.common_tags
}

# ---- Lambda functions (Python, JS, R) ----------------------

module "lambda" {
  source = "../macro-lambda"

  environment         = var.environment
  isolated_subnet_ids = var.isolated_subnet_ids
  lambda_sg_id        = var.lambda_sg_id

  ecr_repository_urls = {
    python = module.ecr_python.repository_url
    js     = module.ecr_js.repository_url
    r      = module.ecr_r.repository_url
  }

  ecr_repository_arns = {
    python = module.ecr_python.repository_arn
    js     = module.ecr_js.repository_arn
    r      = module.ecr_r.repository_arn
  }

  flow_log_group_name = module.flow_logs.log_group_name

  lambda_functions   = var.lambda_functions
  log_retention_days = var.log_retention_days

  tags = var.tags
}

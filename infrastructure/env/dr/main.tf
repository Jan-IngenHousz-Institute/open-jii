# ─────────────────────────────────────────────────────────────────────────────
# DR environment — eu-west-1
#
# Mirrors env/prod/main.tf with the following intentional differences:
#   - Aurora is RESTORED from an AWS Backup snapshot (var.aurora_snapshot_identifier)
#   - ECR repositories are referenced via data sources (already replicated by prod)
#   - CloudFront ACM certs (us-east-1) are REUSED from prod via data sources —
#     no DNS validation wait. The regional ALB cert (eu-west-1) is still created
#     fresh since prod's ALB cert lives in eu-central-1.
#   - Databricks modules are OMITTED — it's a global SaaS service unaffected by
#     an AWS regional outage; prod workspace credentials are passed via tfvars
#   - Grafana is OMITTED — not customer-facing, not critical for recovery
#   - Databricks S3 bucket is OMITTED — prod workspace keeps using its own bucket
#   - AWS Backup module is OMITTED — DR doesn't back up to a third region
#   - CloudTrail is OMITTED — nice-to-have, not required for service recovery
#   - dev_subdomain_delegation is OMITTED — prod-only concern
#   - Route53 REUSES the existing prod zone (no new zone created); DNS records
#     pointing traffic to DR are only created when var.enable_dns_cutover = true
# ─────────────────────────────────────────────────────────────────────────────

module "terraform_state_s3" {
  source      = "../../modules/s3"
  bucket_name = "open-jii-terraform-state-${var.environment}"

  providers = {
    aws    = aws
    aws.dr = aws.dr
  }
}

module "terraform_state_lock" {
  source     = "../../modules/dynamodb"
  table_name = "terraform-state-lock"
}

module "iam_oidc" {
  source     = "../../modules/iam-oidc"
  role_name  = "GithubActionsDeployAccess"
  repository = "Jan-IngenHousz-Institute/open-jii"
  branch     = "main"
  aws_region = var.aws_region

  environment        = var.environment
  github_environment = var.environment
}

module "cloudwatch" {
  source                 = "../../modules/cloudwatch"
  aws_region             = var.aws_region
  log_retention_days     = 60
  cloudwatch_role_name   = "open_jii_${var.environment}_iot_logging_role"
  cloudwatch_policy_name = "open_jii_${var.environment}_iot_logging_policy"
}

module "logs_bucket" {
  source      = "../../modules/s3"
  bucket_name = "open-jii-${var.environment}-access-logs"

  enable_versioning = false

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "Terraform"
    Component   = "logging"
  }

  providers = {
    aws    = aws
    aws.dr = aws.dr
  }
}

module "docusaurus_s3" {
  source                      = "../../modules/s3"
  enable_versioning           = false
  bucket_name                 = "open-jii-docs-public-${var.environment}"
  cloudfront_distribution_arn = module.docs_cloudfront.cloudfront_distribution_arn

  providers = {
    aws    = aws
    aws.dr = aws.dr
  }
}

module "timestream" {
  source        = "../../modules/timestream"
  database_name = "open_jii_${var.environment}_data_ingest_db"
  table_name    = "measurements"
}

module "kinesis" {
  source      = "../../modules/kinesis"
  stream_name = "open-jii-${var.environment}-data-ingest-stream"

  workspace_kinesis_credential_id = var.kinesis_credential_id
}

module "iot_core" {
  source      = "../../modules/iot-core"
  environment = var.environment

  timestream_table           = "measurements"
  timestream_database        = "open_jii_${var.environment}_data_ingest_db"
  iot_timestream_role_name   = "open_jii_${var.environment}_iot_timestream_role"
  iot_timestream_policy_name = "open_jii_${var.environment}_iot_timestream_policy"

  iot_kinesis_role_name   = "open_jii_${var.environment}_iot_kinesis_role"
  iot_kinesis_policy_name = "open_jii_${var.environment}_iot_kinesis_policy"
  kinesis_stream_name     = module.kinesis.kinesis_stream_name
  kinesis_stream_arn      = module.kinesis.kinesis_stream_arn

  cloudwatch_role_arn = module.cloudwatch.iot_cloudwatch_role_arn
}

module "cognito" {
  source                           = "../../modules/cognito"
  region                           = var.aws_region
  environment                      = var.environment
  identity_pool_name               = "open-jii-${var.environment}-iot-identity-pool"
  allow_unauthenticated_identities = true
}

module "vpc" {
  source      = "../../modules/vpc"
  environment = var.environment
}

module "vpc_endpoints" {
  source = "../../modules/vpc-endpoints"

  aws_region  = var.aws_region
  environment = var.environment

  vpc_id                  = module.vpc.vpc_id
  private_route_table_ids = module.vpc.private_rt_ids
  public_route_table_ids  = module.vpc.public_rt_ids
  private_subnet_ids      = module.vpc.private_subnets
  security_group_ids      = [module.vpc.default_sg_id]
}

# ─── Aurora DB — restored from AWS Backup cross-region snapshot ───────────────
# Before running `terraform apply`, locate the shared snapshot in the DR vault:
#   aws backup list-recovery-points-by-backup-vault \
#     --backup-vault-name open-jii-prod-backup-vault \
#     --region eu-west-1
# Then pass the RecoveryPointArn as var.aurora_snapshot_identifier.
module "aurora_db" {
  source                 = "../../modules/aurora_db"
  cluster_identifier     = "open-jii-${var.environment}-db-cluster"
  database_name          = "openjii_prod_db"
  master_username        = "openjii_prod_admin"
  db_subnet_group_name   = module.vpc.db_subnet_group_name
  vpc_security_group_ids = [module.vpc.aurora_security_group_id]

  environment              = var.environment
  max_capacity             = 1.0
  min_capacity             = 0
  seconds_until_auto_pause = 1800
  backup_retention_period  = 1 # minimal retention in DR; prod vault holds the authoritative backups
  skip_final_snapshot      = true

  snapshot_identifier = var.aurora_snapshot_identifier
}

module "secrets_rotation_trigger" {
  source = "../../modules/secrets-manager-rotation/secrets-rotation-trigger"

  ecs_cluster_name = module.backend_ecs.ecs_cluster_name
  ecs_service_name = module.backend_ecs.ecs_service_name
  region           = var.aws_region
  secret_arn       = module.aurora_db.master_user_secret_arn
  environment      = var.environment
}

# ─── ECR — data sources only (images already replicated from eu-central-1) ────
data "aws_ecr_repository" "backend" {
  name = "open-jii-backend"
}

data "aws_ecr_repository" "migration_runner" {
  name = "db-migration-runner-ecr"
}

# ─── Secrets ─────────────────────────────────────────────────────────────────

module "auth_secrets" {
  source = "../../modules/secrets-manager"

  name        = "openjii-auth-secrets-${var.environment}"
  description = "Authentication and OAuth secrets for the openJII services"

  secret_string = jsonencode({
    AUTH_SECRET        = var.auth_secret
    AUTH_GITHUB_ID     = var.github_oauth_client_id
    AUTH_GITHUB_SECRET = var.github_oauth_client_secret
    AUTH_ORCID_ID      = var.orcid_oauth_client_id
    AUTH_ORCID_SECRET  = var.orcid_oauth_client_secret
  })

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
    SecretType  = "authentication"
  }
}

# Databricks secrets populated from tfvars — the prod Databricks workspace is
# still live (global SaaS), so the same credentials and job IDs are valid.
module "databricks_secrets" {
  source = "../../modules/secrets-manager"

  name        = "openjii-databricks-secrets-${var.environment}"
  description = "Databricks connection secrets for the openJII services"

  secret_string = jsonencode({
    DATABRICKS_HOST                     = var.databricks_host
    DATABRICKS_CLIENT_ID                = var.databricks_service_principal_client_id
    DATABRICKS_CLIENT_SECRET            = var.databricks_service_principal_client_secret
    DATABRICKS_AMBYTE_PROCESSING_JOB_ID = var.databricks_ambyte_processing_job_id
    DATABRICKS_DATA_EXPORT_JOB_ID       = var.databricks_data_export_job_id
    DATABRICKS_WAREHOUSE_ID             = var.backend_databricks_warehouse_id
    DATABRICKS_WEBHOOK_API_KEY_ID       = var.backend_webhook_api_key_id
    DATABRICKS_WEBHOOK_SECRET           = var.backend_webhook_secret
    DATABRICKS_WEBHOOK_API_KEY          = var.backend_webhook_api_key
  })

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
    SecretType  = "databricks"
  }
}

module "contentful_secrets" {
  source = "../../modules/secrets-manager"

  name        = "openjii-contentful-secrets-${var.environment}"
  description = "Contentful API secrets for the openJII services"

  secret_string = jsonencode({
    CONTENTFUL_SPACE_ID             = var.contentful_space_id
    CONTENTFUL_ACCESS_TOKEN         = var.contentful_access_token
    CONTENTFUL_PREVIEW_ACCESS_TOKEN = var.contentful_preview_access_token
    CONTENTFUL_PREVIEW_SECRET       = var.contentful_preview_secret
  })

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "web"
    SecretType  = "contentful"
  }
}

# NOTE: SES domain verification adds DKIM TXT records to the prod Route53 zone.
# During an actual failover (prod is down) this is safe. During a DR drill while
# prod is live, the DR DKIM records will overwrite prod DKIM records and may
# temporarily break transactional email in prod for ~72 h (DNS TTL). Plan the
# drill accordingly or comment this module out during drills.
module "ses" {
  source = "../../modules/ses"

  region                 = var.aws_region
  domain_name            = var.domain_name
  subdomain              = "mail"
  environment            = var.environment
  use_environment_prefix = false
  route53_zone_id        = module.route53.route53_zone_id

  allowed_from_addresses = [
    "auth@mail.${var.domain_name}",
    "notifications@mail.${var.domain_name}",
  ]

  create_smtp_user            = true
  enable_event_publishing     = true
  enable_dmarc_reports        = true
  dmarc_report_retention_days = 90

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "email"
  }
}

module "ses_secrets" {
  source = "../../modules/secrets-manager"

  name        = "openjii-ses-secrets-${var.environment}"
  description = "SES SMTP credentials for transactional email sending"

  secret_string = jsonencode({
    AUTH_EMAIL_SERVER    = module.ses.auth_email_server
    AUTH_EMAIL_FROM      = "auth@mail.${var.domain_name}"
    BACKEND_EMAIL_SERVER = module.ses.auth_email_server
    BACKEND_EMAIL_FROM   = "notifications@mail.${var.domain_name}"
  })

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "email"
    SecretType  = "ses"
  }
}

# ─── ECS ─────────────────────────────────────────────────────────────────────

module "migration_runner_ecs" {
  source = "../../modules/ecs"

  region      = var.aws_region
  environment = var.environment

  create_ecs_service = false
  service_name       = "db-migration-runner"

  repository_url = data.aws_ecr_repository.migration_runner.repository_url
  repository_arn = data.aws_ecr_repository.migration_runner.arn

  security_groups = [module.vpc.migration_task_security_group_id]
  subnets         = module.vpc.private_subnets
  vpc_id          = module.vpc.vpc_id

  desired_count      = 1
  cpu                = 256
  memory             = 512
  use_spot_instances = false
  enable_autoscaling = false

  enable_container_healthcheck = false
  enable_circuit_breaker       = true

  log_group_name     = "/aws/ecs/db-migration-runner-${var.environment}"
  log_retention_days = 30

  secrets = [
    {
      name      = "DB_CREDENTIALS"
      valueFrom = module.aurora_db.master_user_secret_arn
    }
  ]

  environment_variables = [
    { name = "DB_HOST", value = module.aurora_db.cluster_endpoint },
    { name = "DB_NAME", value = module.aurora_db.database_name },
    { name = "DB_PORT", value = module.aurora_db.cluster_port },
    { name = "LOG_LEVEL", value = "debug" },
  ]

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "database-migrations"
  }
}

module "backend_alb" {
  source = "../../modules/alb"

  service_name      = "backend"
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnets
  container_port    = var.backend_container_port
  security_groups   = [module.vpc.alb_security_group_id]
  environment       = var.environment

  health_check_path                = "/health"
  health_check_timeout             = 5
  health_check_interval            = 90
  health_check_healthy_threshold   = 3
  health_check_unhealthy_threshold = 3
  health_check_matcher             = "200-299"

  certificate_arn         = module.route53.regional_services_certificate_arn
  cloudfront_header_value = var.api_cloudfront_header_value

  enable_access_logs = true
  access_logs_bucket = module.logs_bucket.bucket_id

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
  }
}

module "backend_ecs" {
  source = "../../modules/ecs"

  region      = var.aws_region
  environment = var.environment

  create_ecs_service = true
  service_name       = "backend"

  repository_url = data.aws_ecr_repository.backend.repository_url
  repository_arn = data.aws_ecr_repository.backend.arn

  vpc_id          = module.vpc.vpc_id
  subnets         = module.vpc.private_subnets
  security_groups = [module.vpc.ecs_security_group_id]

  container_port = var.backend_container_port

  cpu               = 512
  memory            = 1024
  container_cpu     = 512
  container_memory  = 1024
  ephemeral_storage = 21

  target_group_arn = module.backend_alb.target_group_arn

  enable_autoscaling = true
  min_capacity       = 1
  max_capacity       = 3
  cpu_threshold      = 80

  enable_mixed_capacity = true
  fargate_spot_weight   = 0.8
  fargate_base_count    = 1
  desired_count         = 1

  enable_container_healthcheck = true
  health_check_path            = "/health"

  enable_circuit_breaker               = true
  enable_circuit_breaker_with_rollback = true

  log_group_name     = "/aws/ecs/backend-service-${var.environment}"
  log_retention_days = 30

  enable_cognito_policy     = true
  cognito_identity_pool_arn = module.cognito.identity_pool_arn

  secrets = [
    { name = "AUTH_GITHUB_ID", valueFrom = "${module.auth_secrets.secret_arn}:AUTH_GITHUB_ID::" },
    { name = "AUTH_GITHUB_SECRET", valueFrom = "${module.auth_secrets.secret_arn}:AUTH_GITHUB_SECRET::" },
    { name = "AUTH_ORCID_ID", valueFrom = "${module.auth_secrets.secret_arn}:AUTH_ORCID_ID::" },
    { name = "AUTH_ORCID_SECRET", valueFrom = "${module.auth_secrets.secret_arn}:AUTH_ORCID_SECRET::" },
    { name = "AUTH_SECRET", valueFrom = "${module.auth_secrets.secret_arn}:AUTH_SECRET::" },
    { name = "AUTH_EMAIL_SERVER", valueFrom = "${module.ses_secrets.secret_arn}:AUTH_EMAIL_SERVER::" },
    { name = "AUTH_EMAIL_FROM", valueFrom = "${module.ses_secrets.secret_arn}:AUTH_EMAIL_FROM::" },
    { name = "DATABRICKS_CLIENT_ID", valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_CLIENT_ID::" },
    { name = "DATABRICKS_CLIENT_SECRET", valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_CLIENT_SECRET::" },
    { name = "DATABRICKS_HOST", valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_HOST::" },
    { name = "DATABRICKS_AMBYTE_PROCESSING_JOB_ID", valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_AMBYTE_PROCESSING_JOB_ID::" },
    { name = "DATABRICKS_DATA_EXPORT_JOB_ID", valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_DATA_EXPORT_JOB_ID::" },
    { name = "DATABRICKS_WAREHOUSE_ID", valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_WAREHOUSE_ID::" },
    { name = "DATABRICKS_WEBHOOK_API_KEY_ID", valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_WEBHOOK_API_KEY_ID::" },
    { name = "DATABRICKS_WEBHOOK_API_KEY", valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_WEBHOOK_API_KEY::" },
    { name = "DATABRICKS_WEBHOOK_SECRET", valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_WEBHOOK_SECRET::" },
    { name = "DB_CREDENTIALS", valueFrom = module.aurora_db.master_user_secret_arn },
    { name = "EMAIL_SERVER", valueFrom = "${module.ses_secrets.secret_arn}:BACKEND_EMAIL_SERVER::" },
    { name = "EMAIL_FROM", valueFrom = "${module.ses_secrets.secret_arn}:BACKEND_EMAIL_FROM::" },
  ]

  environment_variables = [
    { name = "DATABRICKS_CATALOG_NAME", value = var.databricks_catalog_name },
    { name = "DATABRICKS_CENTRUM_SCHEMA_NAME", value = "centrum" },
    { name = "DATABRICKS_RAW_DATA_TABLE_NAME", value = "enriched_experiment_raw_data" },
    { name = "DATABRICKS_DEVICE_DATA_TABLE_NAME", value = "experiment_device_data" },
    { name = "DATABRICKS_RAW_AMBYTE_DATA_TABLE_NAME", value = "enriched_raw_ambyte_data" },
    { name = "DATABRICKS_MACRO_DATA_TABLE_NAME", value = "enriched_experiment_macro_data" },
    { name = "DB_HOST", value = module.aurora_db.cluster_endpoint },
    { name = "DB_NAME", value = module.aurora_db.database_name },
    { name = "DB_PORT", value = module.aurora_db.cluster_port },
    { name = "LOG_LEVEL", value = "debug" },
    { name = "CORS_ENABLED", value = "true" },
    { name = "CORS_ORIGINS", value = "https://${module.route53.environment_domain}" },
    { name = "COOKIE_DOMAIN", value = ".${var.domain_name}" },
    { name = "ENVIRONMENT_PREFIX", value = var.environment },
    { name = "AWS_LOCATION_PLACE_INDEX_NAME", value = module.location_service.place_index_name },
    { name = "EMAIL_BASE_URL", value = "https://${module.route53.environment_domain}" },
    { name = "AWS_REGION", value = var.aws_region },
    { name = "AWS_COGNITO_IDENTITY_POOL_ID", value = module.cognito.identity_pool_id },
    { name = "AWS_COGNITO_DEVELOPER_PROVIDER_NAME", value = module.cognito.developer_provider_name },
    { name = "POSTHOG_KEY", value = var.posthog_key },
    { name = "POSTHOG_HOST", value = var.posthog_host },
    { name = "NEXT_PUBLIC_BASE_URL", value = "https://${module.route53.environment_domain}" },
    { name = "NEXT_PUBLIC_API_URL", value = "https://${module.route53.api_domain}" },
  ]

  additional_task_role_policy_arns = [
    module.location_service.iam_policy_arn
  ]

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
  }
}

# ─── WAF ─────────────────────────────────────────────────────────────────────

module "opennext_waf" {
  source = "../../modules/waf"

  service_name       = "opennext"
  environment        = var.environment
  rate_limit         = 2500
  log_retention_days = 30

  large_body_bypass_routes = [
    {
      search_string         = "/ingest"
      positional_constraint = "STARTS_WITH"
      method                = "POST"
    }
  ]

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "frontend"
  }
}

module "backend_waf" {
  source = "../../modules/waf"

  service_name       = "backend"
  environment        = var.environment
  rate_limit         = 500
  log_retention_days = 30

  large_body_bypass_routes = [
    {
      search_string         = "/upload"
      positional_constraint = "ENDS_WITH"
      method                = "POST"
    },
    {
      search_string         = "/api/v1/macros"
      positional_constraint = "STARTS_WITH"
      method                = "POST"
    }
  ]

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
  }
}

module "docs_waf" {
  source = "../../modules/waf"

  service_name       = "docs"
  environment        = var.environment
  rate_limit         = 500
  log_retention_days = 30

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "Terraform"
    Component   = "documentation-waf"
  }
}

# ─── CloudFront ───────────────────────────────────────────────────────────────

module "backend_cloudfront" {
  source = "../../modules/backend-cloudfront"

  service_name    = "backend"
  environment     = var.environment
  alb_domain_name = module.backend_alb.alb_dns_name

  custom_header_value = var.api_cloudfront_header_value

  price_class = "PriceClass_100"
  default_ttl = 0
  max_ttl     = 0

  certificate_arn = module.route53.cloudfront_certificate_arns["api"]
  custom_domain   = module.route53.api_domain
  waf_acl_id      = module.backend_waf.cloudfront_web_acl_arn

  enable_logging = true
  log_bucket     = module.logs_bucket.bucket_id

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
  }
}

module "docs_cloudfront" {
  source          = "../../modules/cloudfront"
  aws_region      = var.aws_region
  bucket_name     = module.docusaurus_s3.bucket_name
  certificate_arn = module.route53.cloudfront_certificate_arns["docs"]
  custom_domain   = module.route53.docs_domain
  waf_acl_id      = module.docs_waf.cloudfront_web_acl_arn
}

module "opennext" {
  source = "../../modules/opennext"

  project_name = "open-jii"
  environment  = var.environment
  region       = var.aws_region

  domain_name     = module.route53.environment_domain
  certificate_arn = module.route53.cloudfront_certificate_arns["web"]
  hosted_zone_id  = module.route53.route53_zone_id

  function_url_authorization_type = "AWS_IAM"

  waf_acl_id = module.opennext_waf.cloudfront_web_acl_arn

  enable_logging = true
  log_bucket     = module.logs_bucket.bucket_id

  contentful_secret_arn = module.contentful_secrets.secret_arn

  server_environment_variables = {
    COOKIE_DOMAIN = ".${var.domain_name}"
    NODE_ENV      = "production"
  }

  enable_lambda_warming = true
  price_class           = "PriceClass_100"

  enable_cloudwatch_logs = true
  log_retention_days     = 14
  enable_xray_tracing    = false

  server_memory_size     = 1024
  image_memory_size      = 1536
  revalidate_memory_size = 512
  warmer_memory_size     = 512

  dynamodb_billing_mode         = "PAY_PER_REQUEST"
  enable_point_in_time_recovery = true

  enable_dlq        = true
  max_receive_count = 3

  tags = {
    Project     = "open-jii"
    Environment = var.environment
    Component   = "nextjs-app"
    ManagedBy   = "terraform"
  }
}

# ─── ACM certs — reuse prod's validated CloudFront certs (us-east-1) ─────────
# Prod's certs are already DNS-validated for openjii.org, api.openjii.org, and
# docs.openjii.org. Reusing them avoids the DNS propagation wait on every DR
# drill. The regional ALB cert (eu-west-1) is still created fresh by the
# route53 module since prod's ALB cert lives in eu-central-1.
data "aws_acm_certificate" "cloudfront_web" {
  provider    = aws.us_east_1
  domain      = var.domain_name
  statuses    = ["ISSUED"]
  most_recent = true
}

data "aws_acm_certificate" "cloudfront_api" {
  provider    = aws.us_east_1
  domain      = "api.${var.domain_name}"
  statuses    = ["ISSUED"]
  most_recent = true
}

data "aws_acm_certificate" "cloudfront_docs" {
  provider    = aws.us_east_1
  domain      = "docs.${var.domain_name}"
  statuses    = ["ISSUED"]
  most_recent = true
}

# ─── Route53 — reuse prod zone, only flip records when enable_dns_cutover=true ─
# To deploy DR stack safely (no traffic impact):
#   terraform apply -var="enable_dns_cutover=false"
#
# To cut traffic over to DR (actual failover):
#   terraform apply -var="enable_dns_cutover=true"
#
module "route53" {
  source = "../../modules/route53"

  domain_name            = var.domain_name
  environment            = "prod" # keep base_domain = openjii.org (no env prefix)
  use_environment_prefix = false

  existing_zone_id   = var.prod_route53_zone_id
  create_dns_records = var.enable_dns_cutover

  # Reuse prod's already-validated us-east-1 CloudFront certs — no propagation wait
  existing_cloudfront_certificate_arns = {
    "web"  = data.aws_acm_certificate.cloudfront_web.arn
    "api"  = data.aws_acm_certificate.cloudfront_api.arn
    "docs" = data.aws_acm_certificate.cloudfront_docs.arn
  }

  cloudfront_domain_configs = {
    "api"  = "api.${var.domain_name}"
    "docs" = "docs.${var.domain_name}"
    "web"  = var.domain_name
  }

  cloudfront_records = {
    "" = {
      domain_name    = module.opennext.cloudfront_domain_name
      hosted_zone_id = module.opennext.cloudfront_hosted_zone_id
    },
    "docs" = {
      domain_name    = module.docs_cloudfront.cloudfront_distribution_domain_name
      hosted_zone_id = module.docs_cloudfront.cloudfront_hosted_zone_id
    },
    "api" = {
      domain_name    = module.backend_cloudfront.cloudfront_distribution_domain_name
      hosted_zone_id = module.backend_cloudfront.cloudfront_hosted_zone_id
    }
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

module "location_service" {
  source = "../../modules/location-service"

  place_index_name = "open-jii-${var.environment}-places-index"
  data_source      = "Esri"
  description      = "Place Index for openJII search and geocoding operations"
  intended_use     = "SingleUse"
  iam_policy_name  = "OpenJII-${var.environment}-LocationServicePolicy"

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "location-service"
  }
}

module "ssm_opennext_outputs" {
  source = "../../modules/ssm-parameter"

  parameters = {
    assets_bucket = {
      name        = "/opennext/${var.environment}/assets-bucket"
      value       = module.opennext.assets_bucket_name
      description = "S3 bucket name for OpenNext static assets"
      type        = "String"
    }
    cache_bucket = {
      name        = "/opennext/${var.environment}/cache-bucket"
      value       = module.opennext.cache_bucket_name
      description = "S3 bucket name for OpenNext cache"
      type        = "String"
    }
    server_function = {
      name        = "/opennext/${var.environment}/server-function"
      value       = module.opennext.server_function_name
      description = "Lambda function name for OpenNext server"
      type        = "String"
    }
    image_function = {
      name        = "/opennext/${var.environment}/image-function"
      value       = module.opennext.image_function_name
      description = "Lambda function name for OpenNext image optimization"
      type        = "String"
    }
    revalidation_function = {
      name        = "/opennext/${var.environment}/revalidation-function"
      value       = module.opennext.revalidation_function_name
      description = "Lambda function name for OpenNext revalidation"
      type        = "String"
    }
    warmer_function = {
      name        = "/opennext/${var.environment}/warmer-function"
      value       = module.opennext.warmer_function_name
      description = "Lambda function name for OpenNext warmer"
      type        = "String"
    }
    cloudfront_distribution_id = {
      name        = "/opennext/${var.environment}/cloudfront-distribution-id"
      value       = module.opennext.cloudfront_distribution_id
      description = "CloudFront distribution ID for OpenNext"
      type        = "String"
    }
    backend_task_definition_family = {
      name        = "/backend/${var.environment}/ecs/task-definition-family"
      value       = module.backend_ecs.ecs_task_definition_family
      description = "ECS task definition family for backend service"
      type        = "String"
      tier        = "Standard"
    }
    backend_task_definition_arn = {
      name        = "/backend/${var.environment}/ecs/task-definition-arn"
      value       = module.backend_ecs.ecs_task_definition_arn
      description = "Full ARN (family + revision) of backend ECS task definition"
      type        = "String"
      tier        = "Standard"
    }
    backend_container_name = {
      name        = "/backend/${var.environment}/ecs/container-name"
      value       = module.backend_ecs.container_name
      description = "Primary container name for backend task definition"
      type        = "String"
      tier        = "Standard"
    }
    dynamodb_table = {
      name        = "/opennext/${var.environment}/dynamodb-table-name"
      value       = module.opennext.dynamodb_table_name
      description = "DynamoDB table name for OpenNext cache/revalidation"
      type        = "String"
    }
    migration_runner_ecs_cluster = {
      name        = "/migration/${var.environment}/ecs-cluster-name"
      value       = module.migration_runner_ecs.ecs_cluster_name
      description = "ECS cluster name for running database migrations"
      type        = "String"
    }
    migration_runner_task_definition = {
      name        = "/migration/${var.environment}/task-definition-family"
      value       = module.migration_runner_ecs.ecs_task_definition_family
      description = "Task definition family for database migrations"
      type        = "String"
    }
    migration_runner_container = {
      name        = "/migration/${var.environment}/container-name"
      value       = module.migration_runner_ecs.container_name
      description = "Name of the primary container in the ECS task definition for migrations"
      type        = "String"
    }
    migration_runner_subnets = {
      name        = "/migration/${var.environment}/subnets"
      value       = jsonencode(module.vpc.private_subnets)
      description = "Subnet IDs for the database migration task"
      type        = "String"
    }
    migration_runner_security_group = {
      name        = "/migration/${var.environment}/security-group-id"
      value       = module.vpc.migration_task_security_group_id
      description = "Security group ID for the database migration task"
      type        = "String"
    }
    docs_bucket = {
      name        = "/docs/${var.environment}/docs-bucket"
      value       = module.docusaurus_s3.bucket_name
      description = "S3 bucket name for Docusaurus static assets"
      type        = "String"
    }
    docs_cloudfront_distribution_id = {
      name        = "/docs/${var.environment}/cloudfront-distribution-id"
      value       = module.docs_cloudfront.distribution_id
      description = "CloudFront distribution ID for documentation site"
      type        = "String"
    }
  }

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "ssm-parameters"
  }
}

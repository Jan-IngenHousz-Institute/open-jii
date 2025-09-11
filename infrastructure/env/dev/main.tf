module "terraform_state_s3" {
  source      = "../../modules/s3"
  bucket_name = "open-jii-terraform-state-${var.environment}"
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
}

module "cloudwatch" {
  source                 = "../../modules/cloudwatch"
  aws_region             = var.aws_region
  log_retention_days     = 60
  cloudwatch_role_name   = "open_jii_${var.environment}_iot_logging_role"
  cloudwatch_policy_name = "open_jii_${var.environment}_iot_logging_policy"
}

# Access logs bucket
module "logs_bucket" {
  source      = "../../modules/s3"
  bucket_name = "open-jii-${var.aws_region}-access-logs"

  # Configure for logging purposes
  enable_versioning = false

  tags = {
    Environment = "dev"
    Project     = "open-jii"
    ManagedBy   = "Terraform"
    Component   = "logging"
  }
}

module "docusaurus_s3" {
  source                      = "../../modules/s3"
  enable_versioning           = false
  bucket_name                 = "open-jii-docs-public-${var.environment}"
  cloudfront_distribution_arn = module.docs_cloudfront.cloudfront_distribution_arn
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
  source = "../../modules/iot-core"

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
  source             = "../../modules/cognito"
  region             = var.aws_region
  identity_pool_name = "open-jii-${var.environment}-iot-identity-pool"
}

module "vpc" {
  source = "../../modules/vpc"
}

module "vpc_endpoints" {
  source                  = "../../modules/vpc-endpoints"
  aws_region              = var.aws_region
  vpc_id                  = module.vpc.vpc_id
  private_route_table_ids = module.vpc.private_rt_ids
  public_route_table_ids  = module.vpc.public_rt_ids
  private_subnet_ids      = module.vpc.private_subnets
  security_group_ids      = [module.vpc.default_sg_id]
}

module "databricks_workspace_s3_policy" {
  source      = "../../modules/databricks/workspace-s3-policy"
  bucket_name = "open-jii-databricks-root-bucket-${var.environment}"
}

module "databricks_workspace_s3" {
  source             = "../../modules/s3"
  bucket_name        = "open-jii-databricks-root-bucket-${var.environment}"
  enable_versioning  = false
  custom_policy_json = module.databricks_workspace_s3_policy.policy_json
}

module "metastore_s3" {
  source      = "../../modules/metastore-s3"
  bucket_name = "open-jii-databricks-uc-root-bucket"

  providers = {
    databricks.workspace = databricks.workspace
  }
}

module "databricks_workspace" {
  source                = "../../modules/databricks/workspace"
  aws_region            = var.aws_region
  databricks_account_id = var.databricks_account_id
  bucket_name           = module.databricks_workspace_s3.bucket_id
  vpc_id                = module.vpc.vpc_id
  private_subnets       = module.vpc.private_subnets
  sg_id                 = module.vpc.default_sg_id

  kinesis_role_arn  = module.kinesis.role_arn
  kinesis_role_name = module.kinesis.role_name

  principal_ids = [module.node_service_principal.service_principal_id]

  providers = {
    databricks.mws       = databricks.mws
    databricks.workspace = databricks.workspace
  }
}

module "databricks_metastore" {
  source         = "../../modules/databricks/metastore"
  metastore_name = "open_jii_metastore_aws_eu_central_1"
  region         = var.aws_region
  owner          = "account users"
  workspace_ids  = [module.databricks_workspace.workspace_id]

  providers = {
    databricks.mws = databricks.mws
  }

  depends_on = [module.databricks_workspace]
}

module "node_service_principal" {
  source = "../../modules/databricks/service_principal"

  display_name  = "node-service-principal-${var.environment}"
  create_secret = true

  providers = {
    databricks.mws = databricks.mws
  }
}

module "experiment_secret_scope" {
  source = "../../modules/databricks/secret_scope"

  scope_name = "node-webhook-secret-scope-${var.environment}"
  secrets = {
    webhook_api_key_id = var.backend_webhook_api_key_id
    webhook_secret     = var.backend_webhook_secret
  }

  acl_principals  = [module.node_service_principal.service_principal_application_id]
  acl_permissions = ["READ"]

  providers = {
    databricks.workspace = databricks.workspace
  }
}

module "databricks_catalog" {
  source             = "../../modules/databricks/catalog"
  catalog_name       = "open_jii_${var.environment}"
  external_bucket_id = module.metastore_s3.bucket_name

  grants = {
    node_service_principal = {
      principal = module.node_service_principal.service_principal_application_id
      privileges = [
        "BROWSE",
        "CREATE_FUNCTION",
        "CREATE_MATERIALIZED_VIEW",
        "CREATE_MODEL",
        "CREATE_MODEL_VERSION",
        "CREATE_SCHEMA",
        "CREATE_TABLE",
        "CREATE_VOLUME",
        "READ_VOLUME",
        "SELECT",
        "USE_CATALOG",
        "USE_SCHEMA"
      ]
    }
  }

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.databricks_metastore, module.node_service_principal]
}

module "central_schema" {
  source         = "../../modules/databricks/schema"
  catalog_name   = module.databricks_catalog.catalog_name
  schema_name    = "centrum"
  schema_comment = "Central schema for OpenJII sensor data following the medallion architecture"

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.databricks_catalog]
}

module "centrum_pipeline" {
  source = "../../modules/databricks/pipeline"

  name         = "Centrum-DLT-Pipeline-DEV"
  schema_name  = "centrum"
  catalog_name = module.databricks_catalog.catalog_name

  notebook_paths = [
    "/Workspace/Shared/notebooks/pipelines/centrum_pipeline"
  ]

  configuration = {
    "BRONZE_TABLE"            = "raw_data"
    "SILVER_TABLE"            = "clean_data"
    "RAW_KINESIS_TABLE"       = "raw_kinesis_data"
    "KINESIS_STREAM_NAME"     = module.kinesis.kinesis_stream_name
    "CHECKPOINT_PATH"         = "/Volumes/open_jii_dev/centrum/checkpoints/kinesis"
    "SERVICE_CREDENTIAL_NAME" = module.kinesis.role_name
  }

  continuous_mode  = false
  development_mode = true
  serverless       = true

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.central_schema]
}

module "experiment_provisioning_job" {
  source = "../../modules/databricks/job"

  name        = "Experiment-Provisioning-Job-DEV"
  description = "Creates Delta Live Tables pipelines for experiments and reports status to backend webhook"

  max_concurrent_runs           = 1
  use_serverless                = true
  continuous                    = false
  serverless_performance_target = "STANDARD"

  run_as = {
    service_principal_name = module.node_service_principal.service_principal_application_id
  }

  # Configure task retries
  task_retry_config = {
    retries                   = 3
    min_retry_interval_millis = 60000
    retry_on_timeout          = true
  }

  tasks = [
    {
      key           = "experiment_pipeline_create"
      task_type     = "notebook"
      compute_type  = "serverless"
      notebook_path = "/Workspace/Shared/notebooks/tasks/experiment_pipeline_create_task"

      parameters = {
        "experiment_id"            = "{{experiment_id}}"
        "experiment_name"          = "{{experiment_name}}"
        "experiment_pipeline_path" = "/Workspace/Shared/notebooks/pipelines/experiment_pipeline"
        "catalog_name"             = module.databricks_catalog.catalog_name
        "central_schema"           = "centrum"
      }
    },
    {
      key           = "experiment_status_update"
      task_type     = "notebook"
      compute_type  = "serverless"
      notebook_path = "/Workspace/Shared/notebooks/tasks/experiment_status_update_task"

      parameters = {
        "experiment_id"       = "{{experiment_id}}"
        "job_run_id"          = "{{job.run_id}}"
        "task_run_id"         = "{{task.run_id}}"
        "create_result_state" = "{{tasks.experiment_pipeline_create.result_state}}"
        "webhook_url"         = "https://${module.route53.api_domain}${var.backend_status_update_webhook_path}"
        "key_scope"           = module.experiment_secret_scope.scope_name
      }

      depends_on = "experiment_pipeline_create"
    },
  ]

  permissions = [
    {
      principal_application_id = module.node_service_principal.service_principal_application_id
      permission_level         = "CAN_MANAGE_RUN"
    }
  ]

  providers = {
    databricks.workspace = databricks.workspace
  }
}

module "aurora_db" {
  source                 = "../../modules/aurora_db"
  cluster_identifier     = "open-jii-dev-db-cluster"
  database_name          = "openjii_dev_db"
  master_username        = "openjii_dev_admin"
  db_subnet_group_name   = module.vpc.db_subnet_group_name
  vpc_security_group_ids = [module.vpc.aurora_security_group_id]

  max_capacity             = 1.0  # Conservative max for dev
  min_capacity             = 0    # Minimum cost-effective setting (at 0, auto-pause feature is enabled)
  seconds_until_auto_pause = 1800 # Auto-pause after 30 minutes of inactivity
  backup_retention_period  = 3    # Reduced retention for dev
  skip_final_snapshot      = true # Skip snapshot on deletion in dev
}

# Authentication secrets
module "auth_secrets" {
  source = "../../modules/secrets-manager"

  name        = "openjii-auth-secrets-dev"
  description = "Authentication and OAuth secrets for the OpenJII services"

  # Store secrets as JSON using variables
  secret_string = jsonencode({
    AUTH_SECRET        = var.auth_secret
    AUTH_GITHUB_ID     = var.github_oauth_client_id
    AUTH_GITHUB_SECRET = var.github_oauth_client_secret
  })

  tags = {
    Environment = "dev"
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
    SecretType  = "authentication"
  }
}

# Databricks API secrets
module "databricks_secrets" {
  source = "../../modules/secrets-manager"

  name        = "openjii-databricks-secrets-dev"
  description = "Databricks connection secrets for the OpenJII services"

  # Store secrets as JSON using variables
  secret_string = jsonencode({
    DATABRICKS_HOST               = module.databricks_workspace.workspace_url
    DATABRICKS_CLIENT_ID          = module.node_service_principal.service_principal_application_id
    DATABRICKS_CLIENT_SECRET      = module.node_service_principal.service_principal_secret_value
    DATABRICKS_JOB_ID             = module.experiment_provisioning_job.job_id
    DATABRICKS_WAREHOUSE_ID       = var.backend_databricks_warehouse_id
    DATABRICKS_WEBHOOK_API_KEY_ID = var.backend_webhook_api_key_id
    DATABRICKS_WEBHOOK_SECRET     = var.backend_webhook_secret
    DATABRICKS_WEBHOOK_API_KEY    = var.backend_webhook_api_key
  })

  tags = {
    Environment = "dev"
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
    SecretType  = "databricks"
  }
}

# Contentful secrets
module "contentful_secrets" {
  source = "../../modules/secrets-manager"

  name        = "openjii-contentful-secrets-dev"
  description = "Contentful API secrets for the OpenJII services"

  # Store secrets as JSON using variables
  secret_string = jsonencode({
    CONTENTFUL_SPACE_ID             = var.contentful_space_id
    CONTENTFUL_ACCESS_TOKEN         = var.contentful_access_token
    CONTENTFUL_PREVIEW_ACCESS_TOKEN = var.contentful_preview_access_token
    CONTENTFUL_PREVIEW_SECRET       = var.contentful_preview_secret
  })

  tags = {
    Environment = "dev"
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "web"
    SecretType  = "contentful"
  }
}

# WAF for OpenNext Web Application
module "opennext_waf" {
  source = "../../modules/waf"

  service_name       = "opennext"
  environment        = "dev"
  rate_limit         = 500
  log_retention_days = 30

  tags = {
    Environment = "dev"
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "frontend"
  }
}

# OpenNext Next.js Application Infrastructure
module "opennext" {
  source = "../../modules/opennext"

  project_name = "open-jii"
  environment  = var.environment
  region       = var.aws_region

  # Domain configuration - now uncommented and connected
  domain_name     = module.route53.environment_domain
  certificate_arn = module.route53.cloudfront_certificate_arns["web"]
  hosted_zone_id  = module.route53.route53_zone_id

  function_url_authorization_type = "AWS_IAM"

  # VPC configuration for server Lambda database access
  enable_server_vpc               = true
  server_subnet_ids               = module.vpc.private_subnets
  server_lambda_security_group_id = module.vpc.server_lambda_security_group_id

  # WAF integration
  waf_acl_id = module.opennext_waf.cloudfront_web_acl_arn

  # Logging configuration
  enable_logging = true
  log_bucket     = module.logs_bucket.bucket_id

  # Secrets Manager Integration
  db_credentials_secret_arn = module.aurora_db.master_user_secret_arn
  oauth_secret_arn          = module.auth_secrets.secret_arn
  contentful_secret_arn     = module.contentful_secrets.secret_arn

  server_environment_variables = {
    COOKIE_DOMAIN = ".${var.environment}.${var.domain_name}"
    DB_HOST       = module.aurora_db.cluster_endpoint
    DB_PORT       = module.aurora_db.cluster_port
    DB_NAME       = module.aurora_db.database_name
    NODE_ENV      = "production"
  }

  # Performance configuration
  enable_lambda_warming = true
  price_class           = "PriceClass_100"

  # Monitoring configuration
  enable_cloudwatch_logs = true
  log_retention_days     = 14
  enable_xray_tracing    = false

  # Resource configuration
  server_memory_size     = 1024
  image_memory_size      = 1536
  revalidate_memory_size = 512
  warmer_memory_size     = 512

  # DynamoDB configuration
  dynamodb_billing_mode         = "PAY_PER_REQUEST"
  enable_point_in_time_recovery = true

  # SQS configuration
  enable_dlq        = true
  max_receive_count = 3

  tags = {
    Project     = "open-jii"
    Environment = "dev"
    Component   = "nextjs-app"
    ManagedBy   = "terraform"
  }
}

module "migration_runner_ecr" {
  source = "../../modules/ecr"

  aws_region  = var.aws_region
  environment = "dev"

  repository_name               = "db-migration-runner-ecr"
  service_name                  = "db-migration-runner"
  enable_vulnerability_scanning = true
  encryption_type               = "KMS"
  image_tag_mutability          = "MUTABLE"

  ci_cd_role_arn = module.iam_oidc.role_arn

  tags = {
    Environment = "dev"
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "database-migrations"
  }
}

module "migration_runner_ecs" {
  source = "../../modules/ecs"

  region      = var.aws_region
  environment = "dev"

  create_ecs_service = false
  service_name       = "db-migration-runner"

  repository_url = module.migration_runner_ecr.repository_url
  repository_arn = module.migration_runner_ecr.repository_arn

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

  log_group_name     = "/aws/ecs/db-migration-runner-dev"
  log_retention_days = 30


  # Secrets configuration
  secrets = [
    {
      name      = "DB_CREDENTIALS"
      valueFrom = module.aurora_db.master_user_secret_arn
    }
  ]

  # Environment variables for the migration runner
  environment_variables = [
    {
      name  = "DB_HOST"
      value = module.aurora_db.cluster_endpoint
    },
    {
      name  = "DB_NAME"
      value = module.aurora_db.database_name
    },
    {
      name  = "DB_PORT"
      value = module.aurora_db.cluster_port
    },
    {
      name  = "LOG_LEVEL"
      value = "debug"
    },
  ]

  tags = {
    Environment = "dev"
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "database-migrations"
  }
}

module "backend_ecr" {
  source = "../../modules/ecr"

  aws_region                    = var.aws_region
  environment                   = "dev"
  repository_name               = "open-jii-backend"
  service_name                  = "backend"
  max_image_count               = 10
  enable_vulnerability_scanning = true
  encryption_type               = "KMS"
  image_tag_mutability          = "MUTABLE" # Set to MUTABLE for dev, but should be IMMUTABLE for prod

  ci_cd_role_arn = module.iam_oidc.role_arn

  tags = {
    Environment = "dev"
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
  }
}

module "backend_alb" {
  source = "../../modules/alb"

  service_name      = "backend"
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnets
  container_port    = var.backend_container_port
  security_groups   = [module.vpc.alb_security_group_id]
  environment       = "dev"

  # Health check configuration
  health_check_path                = "/health"
  health_check_timeout             = 5
  health_check_interval            = 90
  health_check_healthy_threshold   = 3
  health_check_unhealthy_threshold = 3
  health_check_matcher             = "200-299"

  # SSL/TLS configuration for HTTPS - Uses the certificate from the default region (e.g., eu-central-1)
  certificate_arn         = module.route53.regional_services_certificate_arn
  cloudfront_header_value = var.api_cloudfront_header_value

  # Enable access logs for better security and troubleshooting
  enable_access_logs = true
  access_logs_bucket = module.logs_bucket.bucket_id

  tags = {
    Environment = "dev"
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
  }
}

module "backend_ecs" {
  source = "../../modules/ecs"

  region      = var.aws_region
  environment = "dev"

  # Unlike migration runner, we want a long-running service
  create_ecs_service = true
  service_name       = "backend"

  repository_url = module.backend_ecr.repository_url
  repository_arn = module.backend_ecr.repository_arn

  # Networking configuration
  vpc_id          = module.vpc.vpc_id
  subnets         = module.vpc.private_subnets
  security_groups = [module.vpc.ecs_security_group_id]

  # Container configuration
  container_port = var.backend_container_port

  # Task size
  cpu               = 512  # 0.5 vCPU
  memory            = 1024 # 1 GB
  container_cpu     = 512  # 0.5 vCPU
  container_memory  = 1024 # 1 GB
  ephemeral_storage = 21   # Minimum size (21 GiB)

  # Load balancer integration
  target_group_arn = module.backend_alb.target_group_arn

  # Auto-scaling settings
  enable_autoscaling = true
  min_capacity       = 1  # Scale down to 1 task
  max_capacity       = 3  # Scale up to 3 tasks
  cpu_threshold      = 80 # Scale out at 80% CPU usage

  # Mixed capacity strategy for cost optimization and stability
  enable_mixed_capacity = true
  fargate_spot_weight   = 0.8 # 80% of tasks on Spot for dev environment (cost saving)
  fargate_base_count    = 1   # Keep at least 1 task on regular Fargate for stability 
  desired_count         = 1

  # Container health checks
  enable_container_healthcheck = true
  health_check_path            = "/health"

  # Deployment configuration
  enable_circuit_breaker               = true
  enable_circuit_breaker_with_rollback = true

  # Logs configuration
  log_group_name     = "/aws/ecs/backend-service-dev"
  log_retention_days = 30

  # Secrets configuration
  secrets = [
    {
      name      = "AUTH_GITHUB_ID"
      valueFrom = "${module.auth_secrets.secret_arn}:AUTH_GITHUB_ID::"
    },
    {
      name      = "AUTH_GITHUB_SECRET"
      valueFrom = "${module.auth_secrets.secret_arn}:AUTH_GITHUB_SECRET::"
    },
    {
      name      = "AUTH_SECRET"
      valueFrom = "${module.auth_secrets.secret_arn}:AUTH_SECRET::"
    },
    {
      name      = "DATABRICKS_CLIENT_ID"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_CLIENT_ID::"
    },
    {
      name      = "DATABRICKS_CLIENT_SECRET"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_CLIENT_SECRET::"
    },
    {
      name      = "DATABRICKS_HOST"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_HOST::"
    },
    {
      name      = "DATABRICKS_JOB_ID"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_JOB_ID::"
    },
    {
      name      = "DATABRICKS_WAREHOUSE_ID"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_WAREHOUSE_ID::"
    },
    {
      name      = "DATABRICKS_WEBHOOK_API_KEY_ID"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_WEBHOOK_API_KEY_ID::"
    },
    {
      name      = "DATABRICKS_WEBHOOK_API_KEY"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_WEBHOOK_API_KEY::"
    },
    {
      name      = "DATABRICKS_WEBHOOK_SECRET"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_WEBHOOK_SECRET::"
    },
    {
      name      = "DB_CREDENTIALS"
      valueFrom = module.aurora_db.master_user_secret_arn
    },
  ]

  # Environment variables for the backend service
  environment_variables = [
    {
      name  = "DATABRICKS_CATALOG_NAME"
      value = module.databricks_catalog.catalog_name
    },
    {
      name  = "DB_HOST"
      value = module.aurora_db.cluster_endpoint
    },
    {
      name  = "DB_NAME"
      value = module.aurora_db.database_name
    },
    {
      name  = "DB_PORT"
      value = module.aurora_db.cluster_port
    },
    {
      name  = "LOG_LEVEL"
      value = "debug"
    },
    {
      name  = "CORS_ENABLED"
      value = "true"
    },
    {
      name  = "CORS_ORIGINS"
      value = "https://${module.route53.environment_domain}"
    },
    {
      name  = "COOKIE_DOMAIN"
      value = ".${var.environment}.${var.domain_name}"
    }
  ]

  tags = {
    Environment = "dev"
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
  }
}

module "backend_waf" {
  source = "../../modules/waf"

  service_name       = "backend"
  environment        = "dev"
  rate_limit         = 500
  log_retention_days = 30

  tags = {
    Environment = "dev"
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
  }
}

# CloudFront distribution in front of the backend API
module "backend_cloudfront" {
  source = "../../modules/backend-cloudfront"

  service_name    = "backend"
  environment     = "dev"
  alb_domain_name = module.backend_alb.alb_dns_name

  # Custom header for ALB protection
  custom_header_value = var.api_cloudfront_header_value

  # CloudFront settings
  price_class = "PriceClass_100" # Use only North America and Europe for dev
  default_ttl = 0                # API shouldn't cache by default
  max_ttl     = 0                # API shouldn't cache by default

  # Security settings
  certificate_arn = module.route53.cloudfront_certificate_arns["api"] # Use the us-east-1 certificate for 'api'
  custom_domain   = module.route53.api_domain
  waf_acl_id      = module.backend_waf.cloudfront_web_acl_arn

  # Logging settings
  enable_logging = true
  log_bucket     = module.logs_bucket.bucket_id

  tags = {
    Environment = "dev"
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
  }
}

# WAF for Documentation Site
module "docs_waf" {
  source = "../../modules/waf"

  service_name       = "docs"
  environment        = "dev"
  rate_limit         = 500
  log_retention_days = 30

  tags = {
    Environment = "dev"
    Project     = "open-jii"
    ManagedBy   = "Terraform"
    Component   = "documentation-waf"
  }
}

module "docs_cloudfront" {
  source          = "../../modules/cloudfront"
  aws_region      = var.aws_region
  bucket_name     = module.docusaurus_s3.bucket_name
  certificate_arn = module.route53.cloudfront_certificate_arns["docs"]
  custom_domain   = module.route53.docs_domain
  waf_acl_id      = module.docs_waf.cloudfront_web_acl_arn

  # TODO: Add tags, logging configuration
}

# Route53 configuration for OpenJII services
module "route53" {
  source = "../../modules/route53"

  domain_name = var.domain_name
  environment = var.environment

  # Input for CloudFront domains that need us-east-1 certificates
  cloudfront_domain_configs = {
    "api"  = "api.${var.environment}.${var.domain_name}"  # For the backend API
    "docs" = "docs.${var.environment}.${var.domain_name}" # For the Docusaurus static site
    "web"  = "${var.environment}.${var.domain_name}"      # For the OpenNext frontend
  }

  cloudfront_records = {
    # Root Domain Record
    "" = {
      domain_name    = module.opennext.cloudfront_domain_name
      hosted_zone_id = module.opennext.cloudfront_hosted_zone_id
    },
    # Documentation Site Record
    "docs" = {
      domain_name    = module.docs_cloudfront.cloudfront_distribution_domain_name
      hosted_zone_id = module.docs_cloudfront.cloudfront_hosted_zone_id
    },
    # Backend API Record
    "api" = {
      domain_name    = module.backend_cloudfront.cloudfront_distribution_domain_name
      hosted_zone_id = module.backend_cloudfront.cloudfront_hosted_zone_id
    }
  }

  tags = {
    Environment = "dev"
    ManagedBy   = "Terraform"
  }
}

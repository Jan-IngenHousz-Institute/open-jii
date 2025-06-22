module "terraform_state_s3" {
  source      = "../../modules/s3"
  bucket_name = var.terraform_state_s3_bucket_name
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
  cloudwatch_role_name   = var.iot_logging_role_name
  cloudwatch_policy_name = var.iot_logging_policy_name
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
  bucket_name                 = var.docusaurus_s3_bucket_name
  cloudfront_distribution_arn = module.docs_cloudfront.cloudfront_distribution_arn
}

module "timestream" {
  source        = "../../modules/timestream"
  database_name = var.timestream_database_name
  table_name    = var.timestream_table_name
}

module "kinesis" {
  source      = "../../modules/kinesis"
  stream_name = var.kinesis_stream_name

  workspace_kinesis_credential_id = var.kinesis_credential_id
}

module "iot_core" {
  source = "../../modules/iot-core"

  timestream_table           = var.timestream_table_name
  timestream_database        = var.timestream_database_name
  iot_timestream_role_name   = var.iot_timestream_role_name
  iot_timestream_policy_name = var.iot_timestream_policy_name

  iot_kinesis_role_name   = var.iot_kinesis_role_name
  iot_kinesis_policy_name = var.iot_kinesis_policy_name
  kinesis_stream_name     = module.kinesis.kinesis_stream_name
  kinesis_stream_arn      = module.kinesis.kinesis_stream_arn

  cloudwatch_role_arn = module.cloudwatch.iot_cloudwatch_role_arn
}

module "cognito" {
  source             = "../../modules/cognito"
  region             = var.aws_region
  identity_pool_name = var.iot_cognito_identity_pool_name
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
  bucket_name = var.databricks_bucket_name
}

module "databricks_workspace_s3" {
  source             = "../../modules/s3"
  bucket_name        = var.databricks_bucket_name
  enable_versioning  = false
  custom_policy_json = module.databricks_workspace_s3_policy.policy_json
}

module "metastore_s3" {
  source      = "../../modules/metastore-s3"
  bucket_name = var.unity_catalog_bucket_name

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

module "databricks_catalog" {
  source             = "../../modules/databricks/catalog"
  catalog_name       = var.databricks_catalog_name
  external_bucket_id = module.metastore_s3.bucket_name

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.databricks_metastore]
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
    "CENTRAL_SCHEMA"    = "centrum"
    "BRONZE_TABLE"      = "raw_data"
    "SILVER_TABLE"      = "clean_data"
    "RAW_KINESIS_TABLE" = "raw_kinesis_data"
  }

  continuous_mode  = true
  development_mode = true
  autoscale        = true
  min_workers      = 1
  max_workers      = 2
  node_type_id     = "m5d.large"

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.central_schema]
}

module "kinesis_ingest_cluster" {
  source = "../../modules/databricks/cluster"

  name             = "Kinesis-Ingest-Cluster"
  single_node      = true
  single_user      = true
  single_user_name = var.databricks_client_id
  spark_version    = "16.2.x-scala2.12"

  providers = {
    databricks.workspace = databricks.workspace
  }
}

module "experiment_orchestrator_cluster" {
  source = "../../modules/databricks/cluster"

  name             = "Experiment-Orchestrator-Cluster"
  single_node      = true
  single_user      = true
  single_user_name = var.databricks_client_id
  spark_version    = "16.2.x-scala2.12"

  providers = {
    databricks.workspace = databricks.workspace
  }
}

module "kinesis_ingest_job" {
  source = "../../modules/databricks/job"

  name        = "Kinesis-Stream-Ingest-Job-DEV"
  description = "Handles connection to Kinesis stream and pulls data into the central schema"
  continuous  = true

  tasks = [
    {
      key           = "kinesis_ingest"
      task_type     = "notebook"
      compute_type  = "existing_cluster"
      cluster_id    = module.kinesis_ingest_cluster.cluster_id
      notebook_path = "/Workspace/Shared/notebooks/tasks/kinesis_ingest_task"

      parameters = {
        "kinesis_stream_name"     = module.kinesis.kinesis_stream_name
        "checkpoint_path"         = "/Volumes/open_jii_dev/centrum/checkpoints/kinesis"
        "catalog_name"            = module.databricks_catalog.catalog_name
        "schema_name"             = "centrum"
        "target_table"            = "raw_kinesis_data"
        "service_credential_name" = "unity-catalog-kinesis-role"
      }
    },
  ]

  depends_on = [module.kinesis_ingest_cluster]

  providers = {
    databricks.workspace = databricks.workspace
  }
}

module "experiment_orchestrator_job" {
  source = "../../modules/databricks/job"

  name        = "Experiment-Pipeline-Orchestrator-Job-DEV"
  description = "Orchestrates the experiment pipelines (if neccessary) and monitors the experiment state"

  tasks = [
    {
      key           = "experiment_pipeline_orchestrator"
      task_type     = "notebook"
      compute_type  = "existing_cluster"
      cluster_id    = module.experiment_orchestrator_cluster.cluster_id
      notebook_path = "/Workspace/Shared/notebooks/tasks/experiment_orchestrator_task"
      parameters = {
        "catalog_name"             = module.databricks_catalog.catalog_name
        "central_schema"           = "centrum"
        "experiment_pipeline_path" = "/Workspace/Shared/notebooks/pipelines/experiment_pipeline"
      }
    },
    {
      key           = "experiment_pipeline_monitor"
      task_type     = "notebook"
      compute_type  = "existing_cluster"
      cluster_id    = module.experiment_orchestrator_cluster.cluster_id
      notebook_path = "/Workspace/Shared/notebooks/tasks/experiment_monitor_task"
      parameters = {
        "catalog_name"   = module.databricks_catalog.catalog_name
        "central_schema" = "centrum"
      }

      depends_on = "experiment_pipeline_orchestrator"
    },
  ]

  depends_on = [module.experiment_orchestrator_cluster]

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
    DATABRICKS_HOST          = var.databricks_host
    DATABRICKS_CLIENT_ID     = var.backend_databricks_client_id
    DATABRICKS_CLIENT_SECRET = var.backend_databricks_client_secret
    DATABRICKS_JOB_ID        = var.backend_databricks_job_id
    DATABRICKS_WAREHOUSE_ID  = var.backend_databricks_warehouse_id
  })

  tags = {
    Environment = "dev"
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
    SecretType  = "databricks"
  }
}

# WAF for OpenNext Web Application
module "opennext_waf" {
  source = "../../modules/waf"

  service_name       = "opennext"
  environment        = "dev"
  rate_limit         = 2000
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

  project_name = var.opennext_project_name
  environment  = var.opennext_environment
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

  server_environment_variables = {
    DB_HOST             = module.aurora_db.cluster_endpoint
    DB_PORT             = module.aurora_db.cluster_port
    DB_NAME             = module.aurora_db.database_name
    NEXT_PUBLIC_API_URL = "https://${module.route53.api_domain}"
  }

  # Performance configuration
  enable_lambda_warming = var.opennext_enable_warming
  price_class           = var.opennext_price_class

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
  max_image_count               = var.backend_ecr_max_images
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
  min_capacity       = var.backend_min_capacity  # Scale down to 1 task
  max_capacity       = var.backend_max_capacity  # Scale up to 3 tasks
  cpu_threshold      = var.backend_cpu_threshold # Scale out at 80% CPU usage

  # Mixed capacity strategy for cost optimization and stability
  enable_mixed_capacity = true
  fargate_spot_weight   = 0.8 # 80% of tasks on Spot for dev environment (cost saving)
  fargate_base_count    = 1   # Keep at least 1 task on regular Fargate for stability 
  desired_count         = 1

  # Container health checks
  enable_container_healthcheck = true
  health_check_path            = var.backend_health_check_path

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
  rate_limit         = 2000
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
  bucket_name     = var.docusaurus_s3_bucket_name
  aws_region      = var.aws_region
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


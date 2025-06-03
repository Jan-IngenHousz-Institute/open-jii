data "aws_caller_identity" "current" {}

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

module "cloudfront" {
  source      = "../../modules/cloudfront"
  bucket_name = var.docusaurus_s3_bucket_name
  aws_region  = var.aws_region
}

module "docusaurus_s3" {
  source                      = "../../modules/s3"
  enable_versioning           = false
  bucket_name                 = var.docusaurus_s3_bucket_name
  cloudfront_distribution_arn = module.cloudfront.cloudfront_distribution_arn
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
  catalog_name       = "open_jii_dev"
  external_bucket_id = module.metastore_s3.bucket_name

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.databricks_metastore]
}

module "central_schema" {
  source         = "../../modules/databricks/schema"
  catalog_name   = "open_jii_dev"
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
  catalog_name = "open_jii_dev"

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
        "catalog_name"            = "open_jii_dev"
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
        "catalog_name"             = "open_jii_dev"
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
        "catalog_name"   = "open_jii_dev"
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

# Backend Service ECR Repository
module "backend_ecr" {
  source = "../../modules/ecr"

  repository_name               = "open-jii-backend"
  max_image_count               = 10
  enable_vulnerability_scanning = true
  service_name                  = "backend"
  ci_cd_role_arn                = module.iam_oidc.oidc_role_arn
  environment                   = "dev"
  aws_region                    = var.aws_region

  # Set to MUTABLE for dev, but should be IMMUTABLE for prod
  image_tag_mutability = "MUTABLE"

  tags = {
    Environment = "dev"
    Service     = "backend"
  }
}

# Application Load Balancer for backend service
module "backend_alb" {
  source = "../../modules/alb"

  service_name      = "backend"
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnets
  container_port    = 3020
  security_groups   = [module.vpc.alb_sg_id]
  environment       = "dev"

  # Health check configuration
  health_check_path = "/api/health"

  # Access logs disabled for now, but can be enabled later if needed
  enable_access_logs = false
  access_logs_bucket = ""

  # SSL/TLS configuration - use certificate from Route53 module
  certificate_arn = module.route53.certificate_arn

  tags = {
    Environment = "dev"
    Service     = "backend"
  }
}

# ECS for backend service
module "backend_ecs" {
  source = "../../modules/ecs"

  # Basic settings
  cluster_name = "open-jii"
  service_name = "backend"
  environment  = "dev"

  # Log retention configuration
  log_retention_days = 30

  # Container configuration
  image          = module.backend_ecr.repository_url
  image_tag      = "latest" # TODO: Use specific tags like Git SHA or semantic version for production
  container_port = 3020

  # Task size
  cpu              = 512  # 0.5 vCPU
  memory           = 1024 # 1 GB
  container_cpu    = 256  # 0.25 vCPU 
  container_memory = 512  # 0.5 GB

  # Networking
  vpc_id          = module.vpc.vpc_id
  subnets         = module.vpc.private_subnets
  security_groups = [module.vpc.ecs_sg_id]

  # Load balancer integration
  target_group_arn = module.backend_alb.target_group_arn

  # Auto-scaling settings (cost-optimized for dev)
  enable_autoscaling = true
  min_capacity       = 1
  max_capacity       = 3
  cpu_threshold      = 80

  # Service discovery
  enable_service_discovery = true

  # Use Fargate Spot for cost savings in dev
  use_spot_instances = true
  desired_count      = 1

  # AWS account details for IAM
  region = var.aws_region

  tags = {
    Environment = "dev"
    Service     = "backend"
  }
}

# WAF for ALB protection
module "backend_alb_waf" {
  source = "../../modules/waf"

  service_name       = "backend"
  environment        = "dev"
  alb_arn            = module.backend_alb.alb_arn
  rate_limit         = 2000
  log_retention_days = 30

  tags = {
    Environment = "dev"
    Service     = "backend"
  }
}

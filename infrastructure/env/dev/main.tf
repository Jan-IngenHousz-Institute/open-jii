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

module "aurora_db" {
  source                 = "../../modules/aurora_db"
  cluster_identifier     = "open-jii-dev-db-cluster"
  database_name          = "open-jii-dev-db"
  master_username        = "openjii_dev_admin"
  db_subnet_group_name   = module.vpc.db_subnet_group_name
  vpc_security_group_ids = [module.vpc.aurora_security_group_id]

  max_capacity             = 1.0  # Conservative max for dev
  min_capacity             = 0.5  # Minimum cost-effective setting
  seconds_until_auto_pause = 1800 # Auto-pause after 30 minutes of inactivity
  backup_retention_period  = 3    # Reduced retention for dev
  skip_final_snapshot      = true # Skip snapshot on deletion in dev
}

# OpenNext Next.js Application Infrastructure
module "opennext" {
  source = "../../modules/opennext"

  project_name = var.opennext_project_name
  environment  = var.opennext_environment
  region       = var.aws_region

  # Domain configuration
  domain_name     = var.opennext_domain_name
  subdomain       = var.opennext_subdomain
  certificate_arn = var.opennext_certificate_arn
  hosted_zone_id  = var.opennext_hosted_zone_id

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

module "ecs" {
  source              = "../../modules/ecs"
  cluster_name        = "ECS-OpenJII-Dev"
  environment         = "Dev"
  assign_public_ip    = "false"
  family              = "backend-task"
  cpu                 = 32
  memory              = 32
  network_mode        = "awsvpc"
  container_name      = "open_jii_dev_container"
  image               = var.image
  container_port      = 3020
  host_port           = 3020
  execution_role_arn  = module.ecs.ecs_execution_role_arn
  desired_count       = 1
  subnets             = module.vpc.private_subnet_ids
  security_groups     = [module.vpc.ecs_sg_id]
  target_group_arn    = module.alb.target_group_arn
  vpc_id              = module.vpc.vpc_id
  service_name        = "ECS-Service-OpenJII-Dev"
}

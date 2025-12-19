module "terraform_state_s3" {
  source      = "../../modules/s3"
  bucket_name = "open-jii-terraform-state-${var.environment}"
}

module "terraform_state_lock" {
  source     = "../../modules/dynamodb"
  table_name = "terraform-state-lock"
}

module "vpc" {
  source      = "../../modules/vpc"
  environment = var.environment

  # Use single NAT gateway for cost savings
  nat_gateway_count = 1

  # Disable resources not needed in sandbox
  create_aurora_resources    = false
  create_alb_resources       = false
  create_ecs_resources       = false
  create_migration_resources = false
  create_lambda_resources    = false
}

module "vpc_endpoints" {
  source = "../../modules/vpc-endpoints"

  aws_region  = var.aws_region
  environment = var.environment

  create_kinesis_endpoint = false

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

module "databricks_workspace" {
  source = "../../modules/databricks/workspace"

  aws_region            = var.aws_region
  environment           = var.environment
  databricks_account_id = var.databricks_account_id

  bucket_name     = module.databricks_workspace_s3.bucket_id
  vpc_id          = module.vpc.vpc_id
  private_subnets = module.vpc.private_subnets
  sg_id           = module.vpc.default_sg_id

  providers = {
    databricks.mws       = databricks.mws
    databricks.workspace = databricks.workspace
  }
}

# # Create storage credential for accessing centralized metastore
module "storage_credential" {
  source = "../../modules/databricks/workspace-storage-credential"

  credential_name = "open-jii-${var.environment}-metastore-access"
  role_name       = "open-jii-${var.environment}-uc-access"
  environment     = var.environment
  bucket_name     = var.centralized_metastore_bucket_name
  isolation_mode  = "ISOLATION_MODE_OPEN"

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.databricks_workspace]
}

# # Create external location for this environment
module "external_location" {
  source = "../../modules/databricks/external-location"

  external_location_name  = "external-${var.environment}"
  bucket_name             = var.centralized_metastore_bucket_name
  external_location_path  = "external/${var.environment}"
  storage_credential_name = module.storage_credential.storage_credential_name
  environment             = var.environment
  comment                 = "External location for ${var.environment} environment data"
  isolation_mode          = "ISOLATION_MODE_ISOLATED"

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.storage_credential]
}

module "databricks_catalog" {
  source       = "../../modules/databricks/catalog"
  catalog_name = "open_jii_data_hackathon"

  external_bucket_id     = var.centralized_metastore_bucket_name
  external_location_path = "external/${var.environment}"
  isolation_mode         = "ISOLATED"

  providers = {
    databricks.workspace = databricks.workspace
  }
}

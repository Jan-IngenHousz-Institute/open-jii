module "terraform_state_s3" {
  source      = "../../modules/s3"
  bucket_name = var.terraform_state_s3_bucket_name
}

module "iam_oidc" {
  source     = "../../modules/iam-oidc"
  role_name  = "GithubActionsDeployAccess"
  repository = "Jan-IngenHousz-Institute/open-jii"
  branch     = "main"
}

module "cloudfront" {
  source      = "../../modules/cloudfront"
  bucket_name = var.docusaurus_s3_bucket_name
  aws_region  = var.aws_region
}

module "docusaurus_s3" {
  source                      = "../../modules/docusaurus-s3"
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

module "databricks_s3" {
  source      = "../../modules/databricks-s3"
  bucket_name = var.databricks_bucket_name
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
  bucket_name           = var.databricks_bucket_name
  vpc_id                = module.vpc.vpc_id
  private_subnets       = module.vpc.private_subnets
  sg_id                 = module.vpc.default_sg_id

  kinesis_role_arn  = module.kinesis.role_arn
  kinesis_role_name = module.kinesis.role_name

  providers = {
    databricks.mws = databricks.mws
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

module "ingest_pipeline" {
  source = "../../modules/databricks/pipeline"

  name        = "Centrum-Ingest-Pipeline"
  schema_name = "centrum"

  notebook_paths = [
    "../../modules/databricks/notebooks/ingest_pipeline"
  ]

  configuration = {
    "KINESIS_STREAM_NAME" = module.kinesis.kinesis_stream_name
    "CENTRAL_SCHEMA"      = "centrum"
  }
}

module "transform_pipeline" {
  source = "../../modules/databricks/pipeline"

  name        = "Centrum-Transform-Pipeline"
  schema_name = "centrum"

  notebook_paths = [
    "../../modules/databricks/notebooks/transform_pipeline"
  ]

  configuration = {
    "CENTRAL_SCHEMA" = "centrum"
    "BRONZE_TABLE"   = "raw_data"
  }
}

module "data_processing_job" {
  source = "../../modules/databricks/job"

  name        = "Centrum ELT Workflow"
  description = "Orchestrates the ingest & transform pipelines"

  # Pipeline tasks
  pipeline_tasks = [
    {
      name        = "ingest_pipeline"
      pipeline_id = module.ingest_pipeline.pipeline_id
    },
    {
      name        = "transform_pipeline"
      pipeline_id = module.transform_pipeline.pipeline_id
      depends_on  = "ingest_pipeline"
    }
  ]


  # Run daily at 2am
  schedule = "0 0 2 * * ?"
}

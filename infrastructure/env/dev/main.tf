module "terraform_state_s3" {
  bucket_name = "open-jii-terraform-state-dev"
  source      = "../../modules/s3"
}

module "cloudfront" {
  source      = "../../modules/cloudfront"
  bucket_name = var.bucket_name
}

module "docusaurus_s3" {
  source                      = "../../modules/docusaurus-s3"
  bucket_name                 = var.bucket_name
  cloudfront_distribution_arn = module.cloudfront.cloudfront_distribution_arn
}

module "timestream" {
  source                  = "../../modules/timestream"
  database_name           = var.timestream_database_name
  table_name              = var.timestream_table_name
}

module "kinesis" {
  source      = "../../modules/kinesis"
  stream_name = var.kinesis_stream_name
}

module "iot_core" {
  source                     = "../../modules/iot-core"
  policy_name                = var.iot_policy_name
  rule_name                  = var.iot_rule_name
  iot_timestream_role_name   = var.iot_timestream_role_name
  iot_timestream_policy_name = var.iot_timestream_policy_name
  timestream_database        = var.timestream_database_name
  timestream_table           = var.timestream_table_name
  iot_kinesis_role_name      = var.iot_kinesis_role_name
  iot_kinesis_policy_name    = var.iot_kinesis_policy_name
  kinesis_stream_name        = module.kinesis.kinesis_stream_name
  kinesis_stream_arn         = module.kinesis.kinesis_stream_arn
  topic_filter               = var.topic_filter
}

module "vpc" {
  source = "../../modules/vpc"
  tags   = var.tags
}

module "vpc_endpoints" {
  source = "../../modules/vpc-endpoints"
  tags   = var.tags
  vpc_id = module.vpc.vpc_id
  prefix = "jii-dev"

  private_route_table_ids = module.vpc.private_rt_ids
  public_route_table_ids  = module.vpc.public_rt_ids

  private_subnet_ids = module.vpc.private_subnets

  # Use the default security group for interface endpoints
  security_group_ids = [module.vpc.default_sg_id]
}

module "databricks_s3" {
  source = "../../modules/databricks-s3"
  prefix = "jii-dev"
  tags   = var.tags
}

module "workspace" {
  source                = "../../modules/databricks"
  prefix                = "jii-dev"
  databricks_account_id = var.databricks_account_id
  tags                  = var.tags
  vpc_id                = module.vpc.vpc_id
  private_subnets       = module.vpc.private_subnets
  sg_id                 = module.vpc.default_sg_id
  s3_bucket             = module.databricks_s3.bucket_name
  iam_role_arn          = module.iam.role_arn
}

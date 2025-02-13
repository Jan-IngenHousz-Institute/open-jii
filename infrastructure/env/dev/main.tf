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


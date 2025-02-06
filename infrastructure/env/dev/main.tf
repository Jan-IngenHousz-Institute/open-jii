resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for CloudFront distribution for bucket ${var.bucket_name}"
}

module "docusaurus_s3" {
  source                = "../../modules/docusaurus-s3"
  bucket_name           = var.bucket_name
  oai_canonical_user_id = aws_cloudfront_origin_access_identity.oai.s3_canonical_user_id
}

module "cloudfront" {
  source                  = "../../modules/cloudfront"
  bucket_name             = module.docusaurus_s3.bucket_name
  s3_bucket_rest_endpoint = module.docusaurus_s3.s3_bucket_rest_endpoint
  default_root_object     = var.default_root_object
  oai_access_identity     = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
}

module "terraform_state_s3" {
  source = "../../modules/s3"
}

module "timestream" {
  source                  = "../../modules/timestream"
  database_name           = var.timestream_database_name
  table_name              = var.timestream_table_name
  memory_retention_hours  = var.memory_retention_hours
  magnetic_retention_days = var.magnetic_retention_days
}

module "iot_core" {
  source                     = "../../modules/iot-core"
  policy_name                = var.iot_policy_name
  iot_timestream_role_name   = var.iot_timestream_role_name
  iot_timestream_policy_name = var.iot_timestream_policy_name
  rule_name                  = var.iot_rule_name
  topic_filter               = var.topic_filter

  timestream_database = var.timestream_database_name
  timestream_table    = var.timestream_table_name
}
  
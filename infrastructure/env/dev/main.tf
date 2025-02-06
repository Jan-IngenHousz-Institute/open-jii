module "terraform_state_s3" {
  source = "../../modules/s3"
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
  
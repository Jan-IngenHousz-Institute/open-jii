# The store's config and users as the module renders them, every user's password "local", for a
# throwaway ClickHouse such as the backend's live serving-store specs read through:
#
#   tofu -chdir=infrastructure/modules/serving-store/clickhouse-config/local init
#   tofu -chdir=infrastructure/modules/serving-store/clickhouse-config/local apply -auto-approve
#   tofu -chdir=infrastructure/modules/serving-store/clickhouse-config/local output -raw config_xml > config.xml
#   tofu -chdir=infrastructure/modules/serving-store/clickhouse-config/local output -raw users_xml > users.xml
#
# then mount them as config.d/openjii.xml and users.d/openjii.xml.
module "config" {
  source = "../"

  http_port                 = 8123
  prometheus_port           = 9363
  system_log_retention_days = 30
  password_sha256           = { for role in ["admin", "writer", "reloader", "reader"] : role => sha256("local") }
}

output "config_xml" {
  value = module.config.config_xml
}

output "users_xml" {
  value = module.config.users_xml
}

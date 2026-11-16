output "users" {
  description = "Each role's user: its name, profile, grants and row filters"
  value       = local.users
}

output "config_xml" {
  description = "The server's config.d file"
  value = templatefile("${path.module}/templates/config.xml.tftpl", {
    http_port                 = var.http_port
    prometheus_port           = var.prometheus_port
    system_log_tables         = local.system_log_tables
    system_log_retention_days = var.system_log_retention_days
  })
}

output "users_xml" {
  description = "The server's users.d file"
  value = templatefile("${path.module}/templates/users.xml.tftpl", {
    users = [
      for role, user in local.users : {
        name            = user.name
        profile         = user.profile
        grants          = user.grants
        row_filters     = user.row_filters
        password_sha256 = var.password_sha256[role]
      }
    ]
  })
}

output "host" {
  description = "Private address of the store, stable across instance replacements"
  value       = aws_instance.store.private_ip
}

output "url" {
  description = "HTTP endpoint of the store"
  value       = "http://${aws_instance.store.private_ip}:${var.http_port}"
}

output "usernames" {
  description = "ClickHouse user name per role (admin, writer, reloader, reader)"
  value       = { for role, user in local.users : role => user.name }
}

output "credentials_secret_arns" {
  description = "Secrets Manager secret per role (admin, writer, reloader, reader), each holding username and password, set with `pnpm secrets:set`"
  value       = { for role, credentials in module.credentials : role => credentials.secret_arn }
  sensitive   = true
}

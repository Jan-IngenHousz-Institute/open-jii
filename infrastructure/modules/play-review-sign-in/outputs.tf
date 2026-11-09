output "ecs_secrets" {
  description = "Backend task secrets for the review address and code, empty when review sign-in is off"
  value = [
    for name in(var.enabled ? local.secret_names : []) : {
      name      = name
      valueFrom = "${one(module.secret[*].secret_arn)}:${name}::"
    }
  ]
  sensitive = true
}

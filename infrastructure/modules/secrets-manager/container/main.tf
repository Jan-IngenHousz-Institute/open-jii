# A secret whose value OpenTofu never sees. The value is set with `pnpm secrets:set`, so it stays
# out of every plan and every state file. The resource keeps the address the secrets-manager module
# uses, so a root can switch a secret's source to this module without moving it.
resource "aws_secretsmanager_secret" "secret" {
  name                    = var.name
  description             = var.description
  recovery_window_in_days = var.recovery_window_in_days
  kms_key_id              = var.kms_key_id

  tags = var.tags
}

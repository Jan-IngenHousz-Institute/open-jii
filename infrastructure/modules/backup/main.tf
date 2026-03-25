data "aws_caller_identity" "current" {}

resource "aws_kms_key" "backup_vault_key" {
  description             = "KMS key for AWS Backup vault encryption - ${var.environment}"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(
    {
      Name        = "${var.vault_name}-kms-key"
      Environment = var.environment
      Project     = "open-jii"
    },
    var.tags
  )
}

resource "aws_kms_alias" "backup_vault_key_alias" {
  name          = "alias/${var.vault_name}-key"
  target_key_id = aws_kms_key.backup_vault_key.key_id
}

resource "aws_backup_vault" "primary" {
  name        = var.vault_name
  kms_key_arn = aws_kms_key.backup_vault_key.arn

  tags = merge(
    {
      Name        = var.vault_name
      Environment = var.environment
      Project     = "open-jii"
    },
    var.tags
  )
}

resource "aws_backup_vault" "dr" {
  provider = aws.dr
  name     = "${var.vault_name}-dr"

  tags = merge(
    {
      Name        = "${var.vault_name}-dr"
      Environment = var.environment
      Project     = "open-jii"
      Role        = "disaster-recovery"
    },
    var.tags
  )
}

resource "aws_iam_role" "backup_role" {
  name = "open-jii-${var.environment}-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "backup.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = merge(
    {
      Name        = "open-jii-${var.environment}-backup-role"
      Environment = var.environment
      Project     = "open-jii"
    },
    var.tags
  )
}

resource "aws_iam_role_policy_attachment" "backup_policy" {
  role       = aws_iam_role.backup_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "restore_policy" {
  role       = aws_iam_role.backup_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

# ──────────────────────────────────────────────────────────────────────────────
# Backup plan — daily backups + automatic cross-region copy to DR vault
# Schedule: 02:30 UTC daily
#   - Aurora preferred_backup_window = "00:00-02:00" → AWS Backup runs after
#     the Aurora snapshot is already complete, not during it.
#   - Aurora preferred_maintenance_window = "sun:03:00-sun:07:00" → 02:30
#     finishes before the Sunday maintenance window opens.
# ──────────────────────────────────────────────────────────────────────────────
resource "aws_backup_plan" "main" {
  name = "open-jii-${var.environment}-backup-plan"

  rule {
    rule_name         = "daily-backup-with-dr-copy"
    target_vault_name = aws_backup_vault.primary.name
    schedule          = "cron(30 2 * * ? *)"

    lifecycle {
      delete_after = var.backup_retention_days
    }

    # Cross-region copy to DR vault — this is the core of the DR plan
    copy_action {
      destination_vault_arn = aws_backup_vault.dr.arn

      lifecycle {
        delete_after = var.dr_backup_retention_days
      }
    }
  }

  tags = merge(
    {
      Name        = "open-jii-${var.environment}-backup-plan"
      Environment = var.environment
      Project     = "open-jii"
    },
    var.tags
  )
}

# ──────────────────────────────────────────────────────────────────────────────
# Backup selection — which resources are protected
# Covers: Aurora cluster + DynamoDB tables passed in as ARNs
# ──────────────────────────────────────────────────────────────────────────────
resource "aws_backup_selection" "resources" {
  name         = "open-jii-${var.environment}-backup-selection"
  iam_role_arn = aws_iam_role.backup_role.arn
  plan_id      = aws_backup_plan.main.id

  resources = concat(
    var.aurora_cluster_arns,
    var.dynamodb_table_arns
  )
}

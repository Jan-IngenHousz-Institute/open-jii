locals {
  workspace_name = "${var.environment}-${var.workspace_name}"
}


# Minimal AMG workspace using AWS SSO (recommended)
resource "aws_grafana_workspace" "this" {
  name                     = local.workspace_name
  description              = "Managed Grafana workspace for ${var.environment} environment"
  account_access_type      = "CURRENT_ACCOUNT"
  authentication_providers = ["AWS_SSO"] # or ["SAML"], or ["AWS_SSO","SAML"]
  permission_type          = "SERVICE_MANAGED"
  # The heartbeat dashboards are built and checked on 12.4. The provider upgrades in place, and there
  # is no way back.
  grafana_version = "12.4"
  role_arn        = aws_iam_role.assume.arn

  data_sources = ["CLOUDWATCH"]

  configuration = jsonencode({
    unifiedAlerting = {
      enabled = true
    },
    "plugins" = {
      "pluginAdminEnabled" = false
    }
  })

  tags = {
    Project     = "Open-JII"
    Environment = var.environment
  }

}

resource "aws_iam_role" "assume" {
  name = "${local.workspace_name}-grafana-assume"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Sid    = ""
        Principal = {
          Service = "grafana.amazonaws.com"
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "grafana_cloudwatch" {
  role       = aws_iam_role.assume.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchReadOnlyAccess"
}

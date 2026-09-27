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
  # Infinity, which the daily report reads PostHog through, needs 10.4.8 or later; AMG offers no 10.4
  # patch past 10.4.7. The provider upgrades in place, and there is no way back.
  grafana_version = "12.4"
  role_arn        = aws_iam_role.assume.arn

  data_sources = ["CLOUDWATCH"]

  configuration = jsonencode({
    unifiedAlerting = {
      enabled = true
    },
    # Lets an admin install the Infinity plugin, which the daily report reads PostHog through.
    "plugins" = {
      "pluginAdminEnabled" = true
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

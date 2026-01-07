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
  grafana_version          = "10.4"
  role_arn                 = aws_iam_role.assume.arn

  data_sources = ["CLOUDWATCH"]

  # Example: Enable/disable some workspace options via configuration (JSON string)
  # See registry docs for details.
  # configuration = jsonencode({
  #   unifiedAlerting = { enabled = true }
  # })

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

resource "aws_grafana_workspace_service_account" "admin" {
  name         = "${local.workspace_name}-admin"
  grafana_role = "ADMIN"
  workspace_id = aws_grafana_workspace.this.id
}

resource "aws_grafana_workspace_service_account_token" "admin_token" {
  name               = "${local.workspace_name}-admin-token"
  service_account_id = aws_grafana_workspace_service_account.admin.service_account_id
  seconds_to_live    = 2592000 # 30 days
  workspace_id       = aws_grafana_workspace.this.id
}

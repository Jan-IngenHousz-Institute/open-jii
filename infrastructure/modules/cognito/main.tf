locals {
  developer_provider_name_full = "${var.environment}.${var.developer_provider_name}"
}

data "aws_caller_identity" "current" {}

resource "aws_cognito_identity_pool" "this" {
  identity_pool_name               = var.identity_pool_name
  allow_unauthenticated_identities = true

  developer_provider_name = var.auth_role ? local.developer_provider_name_full : null
}

resource "aws_iam_role" "unauth" {
  name = "${var.identity_pool_name}-unauth-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = "cognito-identity.amazonaws.com" }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        "StringEquals" = {
          "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.this.id
        }
        "ForAnyValue:StringLike" = {
          "cognito-identity.amazonaws.com:amr" = "unauthenticated"
        }
      }
    }]
  })
}

resource "aws_iam_policy" "unauth_iot" {
  name        = "${var.identity_pool_name}-unauth-iot"
  description = "Allow unauthenticated identities to connect and publish to experiment/data_ingest/v1"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["iot:Connect"]
        Resource = "arn:aws:iot:${var.region}:${data.aws_caller_identity.current.account_id}:client/*"
      },
      {
        Effect   = "Allow"
        Action   = ["iot:Publish"]
        Resource = "arn:aws:iot:${var.region}:${data.aws_caller_identity.current.account_id}:topic/experiment/data_ingest/v1/*/*/*/*/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "unauth_iot_attach" {
  role       = aws_iam_role.unauth.name
  policy_arn = aws_iam_policy.unauth_iot.arn
}

resource "aws_iam_role" "auth" {
  count = var.auth_role ? 1 : 0
  name = "${var.identity_pool_name}-auth-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = "cognito-identity.amazonaws.com" }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        "StringEquals" = {
          "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.this.id
        }
        "ForAnyValue:StringLike" = {
          "cognito-identity.amazonaws.com:amr" = "authenticated"
        }
      }
    }]
  })
}

resource "aws_cognito_identity_pool_roles_attachment" "this" {
  identity_pool_id = aws_cognito_identity_pool.this.id
  
  roles = {
    authenticated   = var.auth_role ? aws_iam_role.auth[0].arn : null
    unauthenticated = aws_iam_role.unauth.arn
  }
}

resource "aws_iam_policy" "auth_iot" {
  count       = var.auth_role ? 1 : 0
  name        = "${var.identity_pool_name}-auth-iot"
  description = "Allow authenticated identities to connect and publish to experiment/data_ingest/v1"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["iot:Connect"]
        Resource = "arn:aws:iot:${var.region}:${data.aws_caller_identity.current.account_id}:client/*"
      },
      {
        Effect   = "Allow"
        Action   = ["iot:Publish"]
        Resource = "arn:aws:iot:${var.region}:${data.aws_caller_identity.current.account_id}:topic/experiment/data_ingest/v1/*/*/*/*/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "auth_iot_attach" {
  count      = var.auth_role ? 1 : 0
  role       = aws_iam_role.auth[0].name
  policy_arn = aws_iam_policy.auth_iot[0].arn
}

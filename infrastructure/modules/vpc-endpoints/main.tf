locals {
  all_route_table_ids = concat(
    var.private_route_table_ids,
    var.public_route_table_ids,
    var.isolated_route_table_ids,
  )
  isolated_sg_ids = coalesce(var.isolated_security_group_ids, var.security_group_ids)

  # The sandboxes run user code and reach AWS only through the isolated subnets' endpoints, so these
  # refuse any caller signing as another account. Private DNS routes the whole VPC through them.
  ecr_endpoint_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # GetAuthorizationToken names no repository, so it is checked on the caller's account only.
        Sid       = "AuthorizationTokenForThisAccount"
        Effect    = "Allow"
        Principal = "*"
        Action    = "ecr:GetAuthorizationToken"
        Resource  = "*"
        Condition = {
          StringEquals = { "aws:PrincipalAccount" = data.aws_caller_identity.current.account_id }
        }
      },
      {
        Sid       = "ThisAccountsRepositoriesOnly"
        Effect    = "Allow"
        Principal = "*"
        Action    = "*"
        Resource  = "*"
        Condition = {
          StringEquals = {
            "aws:PrincipalAccount" = data.aws_caller_identity.current.account_id
            "aws:ResourceAccount"  = data.aws_caller_identity.current.account_id
          }
        }
      },
    ]
  })

  logs_endpoint_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "ThisAccountOnly"
      Effect    = "Allow"
      Principal = "*"
      Action    = "*"
      Resource  = "*"
      Condition = {
        StringEquals = { "aws:PrincipalAccount" = data.aws_caller_identity.current.account_id }
      }
    }]
  })
}

data "aws_caller_identity" "current" {}

resource "aws_vpc_endpoint" "s3" {
  count = var.create_s3_endpoint ? 1 : 0

  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = local.all_route_table_ids
  tags              = { Name = "open-jii-s3-vpc-endpoint-${var.environment}" }
}

resource "aws_vpc_endpoint" "sts" {
  count = var.create_sts_endpoint ? 1 : 0

  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.sts"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  private_dns_enabled = true
  security_group_ids  = var.security_group_ids
  tags                = { Name = "open-jii-sts-vpc-endpoint-${var.environment}" }
}

resource "aws_vpc_endpoint" "kinesis_streams" {
  count = var.create_kinesis_endpoint ? 1 : 0

  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.kinesis-streams"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  private_dns_enabled = true
  security_group_ids  = var.security_group_ids
  tags                = { Name = "open-jii-kinesis-vpc-endpoint-${var.environment}" }
}

resource "aws_vpc_endpoint" "ecr_api" {
  count = var.create_ecr_api_endpoint ? 1 : 0

  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.isolated_subnet_ids
  private_dns_enabled = true
  security_group_ids  = local.isolated_sg_ids
  policy              = local.ecr_endpoint_policy
  tags                = { Name = "open-jii-ecr-api-vpc-endpoint-${var.environment}" }
}

resource "aws_vpc_endpoint" "ecr_dkr" {
  count = var.create_ecr_dkr_endpoint ? 1 : 0

  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.isolated_subnet_ids
  private_dns_enabled = true
  security_group_ids  = local.isolated_sg_ids
  policy              = local.ecr_endpoint_policy
  tags                = { Name = "open-jii-ecr-dkr-vpc-endpoint-${var.environment}" }
}

resource "aws_vpc_endpoint" "logs" {
  count = var.create_logs_endpoint ? 1 : 0

  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.isolated_subnet_ids
  private_dns_enabled = true
  security_group_ids  = local.isolated_sg_ids
  policy              = local.logs_endpoint_policy
  tags                = { Name = "open-jii-logs-vpc-endpoint-${var.environment}" }
}

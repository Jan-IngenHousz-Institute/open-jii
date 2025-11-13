locals {
  all_route_table_ids = concat(var.private_route_table_ids, var.public_route_table_ids)
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = local.all_route_table_ids
  tags              = { Name = "open-jii-s3-vpc-endpoint-${var.environment}" }
}

resource "aws_vpc_endpoint" "sts" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.sts"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  private_dns_enabled = true
  security_group_ids  = var.security_group_ids
  tags                = { Name = "open-jii-sts-vpc-endpoint-${var.environment}" }
}

resource "aws_vpc_endpoint" "kinesis_streams" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.kinesis-streams"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  private_dns_enabled = true
  security_group_ids  = var.security_group_ids
  tags                = { Name = "open-jii-kinesis-vpc-endpoint-${var.environment}" }
}

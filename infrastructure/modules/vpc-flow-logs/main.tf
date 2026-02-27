locals {
  default_tags = merge(var.tags, {
    ManagedBy = "Terraform"
    Security  = "forensics"
  })
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/vpc/${var.name_prefix}-flow-logs-${var.environment}"
  retention_in_days = var.retention_in_days

  tags = local.default_tags
}

resource "aws_iam_role" "this" {
  name = "${var.name_prefix}-flow-logs-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "vpc-flow-logs.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.default_tags
}

resource "aws_iam_role_policy" "this" {
  name = "flow-logs-write"
  role = aws_iam_role.this.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ]
      Resource = "${aws_cloudwatch_log_group.this.arn}:*"
    }]
  })
}

resource "aws_flow_log" "this" {
  count = length(var.subnet_ids)

  subnet_id                = var.subnet_ids[count.index]
  traffic_type             = var.traffic_type
  iam_role_arn             = aws_iam_role.this.arn
  log_destination          = aws_cloudwatch_log_group.this.arn
  max_aggregation_interval = var.max_aggregation_interval

  tags = merge(local.default_tags, {
    Name = "${var.name_prefix}-flow-log-${count.index}-${var.environment}"
  })
}

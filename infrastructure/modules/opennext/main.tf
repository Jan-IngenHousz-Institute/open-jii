# Local values for resource naming
locals {
  # Base naming convention
  name_prefix = "${var.project_name}-${var.environment}-opennext"

  # Generate names if not provided
  assets_bucket_name       = var.assets_bucket_name != "" ? var.assets_bucket_name : "${local.name_prefix}-assets"
  cache_bucket_name        = var.cache_bucket_name != "" ? var.cache_bucket_name : "${local.name_prefix}-cache"
  server_function_name     = var.server_function_name != "" ? var.server_function_name : "${local.name_prefix}-server"
  image_function_name      = var.image_function_name != "" ? var.image_function_name : "${local.name_prefix}-image-optimization"
  revalidate_function_name = var.revalidate_function_name != "" ? var.revalidate_function_name : "${local.name_prefix}-revalidation"
  warmer_function_name     = var.warmer_function_name != "" ? var.warmer_function_name : "${local.name_prefix}-warmer"
  dynamodb_table_name      = var.dynamodb_table_name != "" ? var.dynamodb_table_name : "${local.name_prefix}-cache"
  queue_name               = var.revalidation_queue_name != "" ? var.revalidation_queue_name : "${local.name_prefix}-revalidation"

  # Domain configuration
  domain_name = var.subdomain != "" && var.domain_name != "" ? "${var.subdomain}.${var.domain_name}" : var.domain_name
  aliases     = local.domain_name != "" ? [local.domain_name] : []

  # Common tags
  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Component   = "opennext"
  })
}

# S3 Buckets
resource "aws_s3_bucket" "assets" {
  bucket = local.assets_bucket_name
  tags = merge(local.common_tags, {
    Name        = local.assets_bucket_name
    Description = "Static assets bucket for ${var.project_name}"
  })
}

resource "aws_s3_bucket" "cache" {
  bucket = local.cache_bucket_name
  tags = merge(local.common_tags, {
    Name        = local.cache_bucket_name
    Description = "Cache bucket for ${var.project_name}"
  })
}

# S3 Bucket Configuration
resource "aws_s3_bucket_versioning" "assets" {
  count  = var.enable_versioning ? 1 : 0
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "cache" {
  count  = var.enable_versioning ? 1 : 0
  bucket = aws_s3_bucket.cache.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cache" {
  bucket = aws_s3_bucket.cache.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "cache" {
  bucket = aws_s3_bucket.cache.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB Table for ISR
module "dynamodb" {
  source = "../opennext-dynamodb"

  table_name                    = local.dynamodb_table_name
  billing_mode                  = var.dynamodb_billing_mode
  enable_point_in_time_recovery = var.enable_point_in_time_recovery
  tags                          = local.common_tags
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "server" {
  count             = var.enable_cloudwatch_logs ? 1 : 0
  name              = "/aws/lambda/${local.server_function_name}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "image" {
  count             = var.enable_cloudwatch_logs ? 1 : 0
  name              = "/aws/lambda/${local.image_function_name}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "revalidate" {
  count             = var.enable_cloudwatch_logs ? 1 : 0
  name              = "/aws/lambda/${local.revalidate_function_name}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "warmer" {
  count             = var.enable_cloudwatch_logs && var.enable_lambda_warming ? 1 : 0
  name              = "/aws/lambda/${local.warmer_function_name}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

# Lambda Functions
module "server_function" {
  source = "../opennext-lambda"

  function_name       = local.server_function_name
  runtime             = var.lambda_runtime
  handler             = "index.handler"
  memory_size         = var.server_memory_size
  timeout             = var.server_timeout
  architecture        = var.lambda_architecture
  create_function_url = true

  # VPC Configuration for database access
  enable_vpc         = var.enable_server_vpc
  subnet_ids         = var.server_subnet_ids
  security_group_ids = var.enable_server_vpc ? [var.server_lambda_security_group_id] : []

  s3_permissions       = true
  s3_bucket_arns       = [aws_s3_bucket.assets.arn, aws_s3_bucket.cache.arn]
  dynamodb_permissions = true
  dynamodb_table_arns  = [module.dynamodb.table_arn]
  sqs_permissions      = true
  sqs_queue_arns       = [module.sqs.queue_arn]

  environment_variables = merge({
    ASSETS_BUCKET_NAME     = aws_s3_bucket.assets.bucket
    CACHE_BUCKET_NAME      = aws_s3_bucket.cache.bucket
    REVALIDATION_QUEUE_URL = module.sqs.queue_url
    CACHE_DYNAMO_TABLE     = module.dynamodb.table_name
  }, var.db_environment_variables)

  tags = local.common_tags

  depends_on = [aws_cloudwatch_log_group.server]
}

module "image_function" {
  source = "../opennext-lambda"

  function_name       = local.image_function_name
  runtime             = var.lambda_runtime
  handler             = "index.handler"
  memory_size         = var.image_memory_size
  timeout             = var.image_timeout
  architecture        = var.lambda_architecture
  create_function_url = true

  s3_permissions = true
  s3_bucket_arns = [aws_s3_bucket.assets.arn]

  environment_variables = {
    ASSETS_BUCKET_NAME = aws_s3_bucket.assets.bucket
  }

  tags = local.common_tags

  depends_on = [aws_cloudwatch_log_group.image]
}

module "revalidate_function" {
  source = "../opennext-lambda"

  function_name       = local.revalidate_function_name
  runtime             = var.lambda_runtime
  handler             = "index.handler"
  memory_size         = var.revalidate_memory_size
  timeout             = var.revalidate_timeout
  architecture        = var.lambda_architecture
  create_function_url = false

  s3_permissions       = true
  s3_bucket_arns       = [aws_s3_bucket.assets.arn, aws_s3_bucket.cache.arn]
  dynamodb_permissions = true
  dynamodb_table_arns  = [module.dynamodb.table_arn]

  environment_variables = {
    ASSETS_BUCKET_NAME = aws_s3_bucket.assets.bucket
    CACHE_BUCKET_NAME  = aws_s3_bucket.cache.bucket
    CACHE_DYNAMO_TABLE = module.dynamodb.table_name
  }

  tags = local.common_tags

  depends_on = [aws_cloudwatch_log_group.revalidate]
}

# SQS Queue for revalidation
module "sqs" {
  source = "../opennext-sqs"

  queue_name                 = local.queue_name
  revalidation_function_arn  = module.revalidate_function.function_arn
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.message_retention_seconds
  create_dlq                 = var.enable_dlq
  max_receive_count          = var.max_receive_count
  tags                       = local.common_tags
}

# Additional SQS permissions for revalidation function
resource "aws_iam_role_policy" "revalidation_sqs_permissions" {
  name = "${local.revalidate_function_name}-sqs-policy"
  role = module.revalidate_function.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = module.sqs.queue_arn
      }
    ]
  })
}

# Warmer function (optional)
module "warmer_function" {
  count  = var.enable_lambda_warming ? 1 : 0
  source = "../opennext-lambda"

  function_name       = local.warmer_function_name
  runtime             = var.lambda_runtime
  handler             = "index.handler"
  memory_size         = var.warmer_memory_size
  timeout             = var.warmer_timeout
  architecture        = var.lambda_architecture
  create_function_url = false

  lambda_permissions = true
  lambda_function_arns = [
    module.server_function.function_arn,
    module.image_function.function_arn
  ]

  environment_variables = {
    WARM_PARAMS = jsonencode([
      {
        function    = module.server_function.function_name
        concurrency = 1
      },
      {
        function    = module.image_function.function_name
        concurrency = 1
      }
    ])
  }

  tags = local.common_tags

  depends_on = [aws_cloudwatch_log_group.warmer]
}

# EventBridge rule for warming (optional)
resource "aws_cloudwatch_event_rule" "warmer" {
  count               = var.enable_lambda_warming ? 1 : 0
  name                = "${local.name_prefix}-warmer"
  description         = "Trigger Lambda warmer function"
  schedule_expression = "rate(8 hours)"
  tags                = local.common_tags
}

resource "aws_cloudwatch_event_target" "warmer" {
  count     = var.enable_lambda_warming ? 1 : 0
  rule      = aws_cloudwatch_event_rule.warmer[0].name
  target_id = "WarmerTarget"
  arn       = module.warmer_function[0].function_arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  count         = var.enable_lambda_warming ? 1 : 0
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = module.warmer_function[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.warmer[0].arn
}

# CloudFront Distribution
module "cloudfront" {
  source = "../opennext-cloudfront"

  project_name               = var.project_name
  assets_bucket_name         = aws_s3_bucket.assets.bucket
  assets_bucket_domain_name  = aws_s3_bucket.assets.bucket_domain_name
  server_function_url_domain = module.server_function.function_url_domain
  image_function_url_domain  = module.image_function.function_url_domain
  aliases                    = local.aliases
  acm_certificate_arn        = var.certificate_arn != "" ? var.certificate_arn : null
  price_class                = var.price_class
  tags                       = local.common_tags
}

# S3 bucket policy to allow CloudFront OAC access
resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.assets.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = module.cloudfront.distribution_arn
          }
        }
      }
    ]
  })

  depends_on = [module.cloudfront]
}

# Route53 DNS record (optional)
resource "aws_route53_record" "app" {
  count   = var.hosted_zone_id != "" && local.domain_name != "" ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = local.domain_name
  type    = "A"

  alias {
    name                   = module.cloudfront.distribution_domain_name
    zone_id                = module.cloudfront.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

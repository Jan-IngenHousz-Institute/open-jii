module "terraform_state_s3" {
  source      = "../../modules/s3"
  bucket_name = "open-jii-terraform-state-${var.environment}"

  providers = {
    aws    = aws
    aws.dr = aws.dr
  }
}

module "iam_oidc" {
  source     = "../../modules/iam-oidc"
  role_name  = "GithubActionsDeployAccess"
  repository = "Jan-IngenHousz-Institute/open-jii"
  branch     = "main"
  aws_region = var.aws_region

  # Sandbox only manages S3, DynamoDB, VPC/EC2, IAM, KMS, and CloudWatch Logs.
  # All other services (ECS, Lambda, RDS, ECR, etc.) are not deployed here.
  enabled_services = ["s3", "dynamodb", "iam", "kms", "logs", "vpc", "terraform-backend", "sts"]
}

module "terraform_state_lock" {
  source     = "../../modules/dynamodb"
  table_name = "terraform-state-lock"
}

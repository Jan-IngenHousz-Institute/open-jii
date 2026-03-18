# ECR Module

Creates an Amazon Elastic Container Registry repository with security policies and lifecycle management.

## What it does

- Private ECR repository with configurable tag mutability (MUTABLE, IMMUTABLE, or IMMUTABLE_WITH_EXCLUSION)
- Vulnerability scanning on push
- Encryption at rest (AES256 or KMS)
- Repository policy granting least-privilege access to ECS tasks and CI/CD role
- Lifecycle policy to auto-delete old images (keeps last N images)

## Usage

```hcl
module "backend_ecr" {
  source = "../../modules/ecr"

  aws_region      = var.aws_region
  environment     = var.environment
  repository_name = "my-backend"
  service_name    = "backend"

  max_image_count               = 10
  enable_vulnerability_scanning = true
  encryption_type               = "KMS"
  image_tag_mutability          = "IMMUTABLE"

  ci_cd_role_arn = module.iam_oidc.role_arn

  tags = {
    Environment = var.environment
    Project     = "my-project"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `repository_name` | Name of the ECR repository | `string` | — | yes |
| `service_name` | Service name (used in ECS policy ARN) | `string` | — | yes |
| `aws_region` | AWS region | `string` | — | yes |
| `environment` | Environment name | `string` | `dev` | no |
| `image_tag_mutability` | `MUTABLE`, `IMMUTABLE`, or `IMMUTABLE_WITH_EXCLUSION` | `string` | `IMMUTABLE` | no |
| `enable_vulnerability_scanning` | Scan images on push | `bool` | `true` | no |
| `encryption_type` | `AES256` or `KMS` | `string` | `AES256` | no |
| `kms_key_id` | KMS key ID (only if `encryption_type = "KMS"`) | `string` | `null` | no |
| `max_image_count` | Max images to keep (older are deleted) | `number` | `10` | no |
| `ci_cd_role_arn` | IAM role ARN for CI/CD push access | `string` | `null` | no |
| `force_delete` | Allow deletion with images present | `bool` | `false` | no |
| `tags` | Tags to apply | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| `repository_url` | ECR repository URL (use in ECS task definitions) |
| `repository_arn` | ARN of the repository |
| `repository_name` | Name of the repository |
| `repository_registry_id` | Registry ID |

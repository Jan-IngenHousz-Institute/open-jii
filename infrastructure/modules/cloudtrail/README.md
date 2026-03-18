# CloudTrail Module

Creates an AWS CloudTrail trail with a dedicated S3 bucket for audit logging.

## What it does

- Multi-region CloudTrail trail capturing global service events
- Dedicated S3 bucket with public access blocked
- Bucket policy scoped to the trail ARN (least-privilege)

## Usage

```hcl
module "cloud_trail" {
  source = "../../modules/cloudtrail"

  project_name = "open-jii"
  environment  = var.environment
  region       = var.aws_region
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `project_name` | Project name (used in resource naming) | `string` | — | yes |
| `environment` | Environment name | `string` | — | yes |
| `region` | AWS region | `string` | `eu-central-1` | no |

## Outputs

None.

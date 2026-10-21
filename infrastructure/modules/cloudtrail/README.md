# CloudTrail Module

Creates an AWS CloudTrail trail with a dedicated S3 bucket for audit logging.

## What it does

- Multi-region CloudTrail trail capturing global service events, with log file validation
- Log files encrypted with a customer-managed KMS key (rotation enabled), also the bucket's default encryption
- Dedicated S3 bucket with public access blocked, versioning on, and requests over plain HTTP denied
- S3 Object Lock in GOVERNANCE mode: each log file is locked against deletion for `log_retention_days`
- Lifecycle: log files move to Glacier Flexible Retrieval after `log_archive_after_days` and are deleted after `log_expiration_days`, which must be longer than the lock
- Bucket and key policies scoped to the trail ARN (least-privilege)

Object Lock cannot be turned off once it is enabled, and its default retention only applies to log files written after it was turned on.

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

| Name                     | Description                                                     | Type     | Default        | Required |
| ------------------------ | --------------------------------------------------------------- | -------- | -------------- | -------- |
| `project_name`           | Project name (used in resource naming)                          | `string` | —              | yes      |
| `environment`            | Environment name                                                | `string` | —              | yes      |
| `region`                 | AWS region                                                      | `string` | `eu-central-1` | no       |
| `log_retention_days`     | Days each log file is locked against deletion (GOVERNANCE mode) | `number` | `365`          | no       |
| `log_archive_after_days` | Days before log files move to Glacier Flexible Retrieval        | `number` | `90`           | no       |
| `log_expiration_days`    | Days before log files are deleted; must exceed the lock period  | `number` | `400`          | no       |

## Outputs

| Name          | Description                                                |
| ------------- | ---------------------------------------------------------- |
| `trail_name`  | Name of the CloudTrail trail                               |
| `bucket_name` | Name of the S3 bucket that receives the trail's log files  |
| `kms_key_arn` | ARN of the customer-managed KMS key that encrypts the logs |

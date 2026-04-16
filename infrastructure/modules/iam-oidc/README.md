# 🔐 OIDC Module

This module configures an AWS OpenID Connect (OIDC) provider for GitHub Actions and creates an IAM role that can be assumed using OIDC tokens. By leveraging OIDC authentication, you can eliminate the need for storing long-lived AWS credentials in your repositories.

## 📖 Overview

This module performs **registers an OIDC Provider**, i.e. creates (or ensures the existence of) an AWS IAM OIDC provider using GitHub Actions' OIDC endpoint (`https://token.actions.githubusercontent.com`). Additionally, it will **create an IAM Role** , with a trust policy that restricts access to a specific GitHub repository and branch, enabling GitHub Actions workflows to assume this role securely. Finally, the policy is attached with required permissions. The IAM role is granted permissions for VPC, S3, CloudFront, Timestream, Kinesis, AWS Backup, and other relevant actions.

```mermaid
flowchart TD;
    A[GitHub Actions OIDC Token] --> B[OIDC Provider in AWS];
    B --> C[IAM Role Trust Policy];
    C --> D[GitHub Actions Workflow];
```

## 🛠 Resources Used

| Resource                                                                                                                                     | Description                                                                                                       | Documentation                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`aws_iam_openid_connect_provider`](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_openid_connect_provider) | Registers the GitHub Actions OIDC provider in AWS.                                                                | [OIDC Provider](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) |
| [`aws_iam_role`](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role)                                       | Creates an IAM role with a trust policy allowing GitHub Actions to assume it via OIDC.                            | [IAM Role](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)                                                                                            |
| [`aws_iam_policy`](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy)                                   | Defines an inline IAM policy with permissions for VPC, S3, CloudFront, Timestream, Kinesis, AWS Backup, IoT, and IAM actions. | [IAM Policy](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_create-console.html)                                                                    |
| [`aws_iam_role_policy_attachment`](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role_policy_attachment)   | Attaches the generated policy to the IAM role.                                                                    | [Policy Attachment](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_job-functions_create-policies.html)                                              |

## ⚙️ Usage

Include this module in your Terraform configuration as follows:

```hcl
module "oidc" {
  source             = "./iam-oidc"  # Adjust the module path as needed.
  role_name          = "GitHubActionsDeployRole"
  repository         = "myorg/myrepo"
  branch             = "main"
}

output "github_oidc_role_arn" {
  value = module.oidc.role_arn
}
```

This configuration creates an OIDC provider (if not already present) and an IAM role that GitHub Actions can assume via OIDC. The trust policy is limited to workflows originating from the specified repository and branch, as well as from pull requests. The role will have permissions to manage infrastructure related to infrastructure modules, including AWS Backup vault, plan, and selection management, as well as S3 and ECR replication configuration.

## 🔑 Inputs

| Name                | Description                                                                                                   | Type           | Default                                         | Required |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------- | :------: |
| `oidc_provider_url` | The URL of the OIDC provider. For GitHub Actions, use `https://token.actions.githubusercontent.com`.          | `string`       | `"https://token.actions.githubusercontent.com"` |    No    |
| `client_id_list`    | List of client IDs for the OIDC provider. Typically includes `sts.amazonaws.com`.                             | `list(string)` | `["sts.amazonaws.com"]`                         |    No    |
| `thumbprint_list`   | SHA-1 thumbprint(s) of the OIDC provider's TLS certificate, as a lowercase hexadecimal string without colons. | `list(string)` | `["6938fd4d98bab03faadb97b34396831e3780aea1"]`  |    No    |
| `role_name`         | The name of the IAM role to create.                                                                           | `string`       | n/a                                             |   Yes    |
| `repository`        | The GitHub repository in the format `owner/repo` that is allowed to assume the role.                          | `string`       | n/a                                             |   Yes    |
| `branch`            | The main branch that is allowed to assume the role. Pull requests are also allowed by default.                | `string`       | `"main"`                                        |    No    |

## 📤 Outputs

| Name                | Description                                           |
| ------------------- | ----------------------------------------------------- |
| `oidc_provider_arn` | The ARN of the created OIDC provider.                 |
| `role_arn`          | The ARN of the IAM role that can be assumed via OIDC. |

## 🔐 Granted Permissions

The IAM role includes permissions for the following AWS services and operations:

### S3
- Bucket configuration and management (read/write)
- Object operations (Get, Put, Delete)
- **Replication configuration**: `s3:PutReplicationConfiguration`

### ECR (Elastic Container Registry)
- Repository management (Create, Delete, Describe, List)
- Image lifecycle and tagging
- **Replication configuration** (account-level): `ecr:PutReplicationConfiguration`, `ecr:DescribeReplicationConfigurations`, `ecr:DescribeRegistry`
- Image push/pull operations

### AWS Backup
- **Vault management**: `CreateBackupVault`, `DeleteBackupVault`, `DescribeBackupVault`, `ListBackupVaults`
- **Plan management**: `CreateBackupPlan`, `DeleteBackupPlan`, `DescribeBackupPlan`, `GetBackupPlan`, `UpdateBackupPlan`, `ListBackupPlans`
- **Selection management**: `CreateBackupSelection`, `DeleteBackupSelection`, `GetBackupSelection`, `ListBackupSelections`
- **Tagging**: `TagResource`, `UntagResource`, `ListTags`
- **Policy and notification management**: `GetBackupVaultAccessPolicy`, `PutBackupVaultAccessPolicy`, `DeleteBackupVaultAccessPolicy`, `GetBackupVaultNotifications`
- **Storage provisioning**: `backup-storage:MountCapsule` (required by CreateBackupVault to provision the underlying storage capsule for the vault)

### KMS (Key Management Service)
- Key management operations (Create, Delete, Describe, List, Update)
- Key rotation management
- **Data encryption operations**: `kms:GenerateDataKey`, `kms:GenerateDataKeyWithoutPlaintext`, `kms:Decrypt` (required when AWS services such as AWS Backup use a KMS key to encrypt data)
- **Grant management operations**: `kms:CreateGrant`, `kms:ListGrants`, `kms:RevokeGrant` (required by AWS Backup's CreateBackupVault to establish ongoing encryption access for the vault)

### AWS Inspector v2
- **Enable/disable scanning** (create, update, destroy): `inspector2:Enable`
- **Disable scanning**: `inspector2:Disable`
- **Read current account status** (plan/refresh): `inspector2:BatchGetAccountStatus`
- **Provider reads during plan**: `inspector2:ListAccountPermissions`
- **Service-linked role creation** (first-time enablement): `iam:CreateServiceLinkedRole` - Limited to the AWS Inspector v2 service-linked role ARN (`arn:aws:iam::*:role/aws-service-role/inspector2.amazonaws.com/AWSServiceRoleForAmazonInspector2`)

These permissions allow Terraform/OpenTofu to enable and manage AWS Inspector v2 for vulnerability scanning of ECR images and Lambda functions. All actions apply to resource scope `*` (account-level enablement).

### Lambda
- **Function management**: Function configuration and management operations
- **Code signing**: `lambda:GetFunctionCodeSigningConfig` (Terraform provider reads)
- **Event invoke configuration**: `lambda:GetFunctionEventInvokeConfig`, `lambda:PutFunctionEventInvokeConfig`, `lambda:UpdateFunctionEventInvokeConfig`, `lambda:DeleteFunctionEventInvokeConfig` (Terraform manages Lambda function event invoke configurations)
- **Layer management**: `lambda:GetLayerVersion`, `lambda:GetLayerVersionPolicy`, `lambda:ListLayers`, `lambda:ListLayerVersions`, `lambda:PublishLayerVersion` (Terraform provider reads layer metadata before attaching)

### Other Services
- **VPC**: Network infrastructure management
- **CloudFront**: Distribution configuration
- **CloudWatch Logs**: Log group management, tagging operations, and **metric filter management**: `logs:PutMetricFilter`, `logs:DeleteMetricFilter`, `logs:DescribeMetricFilters` (Terraform manages CloudWatch Logs metric filters)
- **Timestream**: Database operations
- **Kinesis**: Stream management
- **IoT**: Device and policy management
- **IAM**: Role and policy management for service integrations

## 🌍 Notes

- **Thumbprint:**  
  The thumbprint is a SHA-1 hash of the TLS certificate used by the OIDC provider. For GitHub Actions, you can retrieve it using OpenSSL. If the provider rotates its certificate, update the thumbprint accordingly.

  Example command to retrieve the thumbprint:

  ```bash
  echo | openssl s_client -servername token.actions.githubusercontent.com -connect token.actions.githubusercontent.com:443 2>/dev/null | openssl x509 -fingerprint -noout | sed 's/://g' | tr 'A-Z' 'a-z'
  ```

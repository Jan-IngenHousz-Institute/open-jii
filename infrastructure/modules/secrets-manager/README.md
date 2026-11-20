# 🔒 Secrets Manager Module

This module creates an AWS Secrets Manager secret and secret version with the supplied secret string. It's designed to securely store and manage application secrets.

For a secret whose value OpenTofu must never hold, use [`container`](container/main.tf) instead: it creates the secret without a version, and the value is set with `pnpm secrets:set`.

## 📖 Overview

AWS Secrets Manager helps you protect secrets needed to access your applications, services, and IT resources. The service enables you to easily rotate, manage, and retrieve database credentials, API keys, and other secrets throughout their lifecycle.

## 🛠 Resources Used

| Resource                            | Description                             | Documentation                                                                                                                                   |
| ----------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws_secretsmanager_secret`         | Creates a secret in AWS Secrets Manager | [AWS Secrets Manager Secret](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/secretsmanager_secret)                 |
| `aws_secretsmanager_secret_version` | Creates a version of the secret         | [AWS Secrets Manager Secret Version](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/secretsmanager_secret_version) |

## ⚙️ Usage

To deploy this Secrets Manager module, include the following Terraform configuration:

```hcl
module "application_secrets" {
  source = "../../modules/secrets-manager"

  name          = "my-application-secrets"
  description   = "Secrets for my application"
  secret_string = jsonencode({
    API_KEY = "your-api-key",
    TOKEN   = "your-token"
  })

  tags = {
    Environment = "dev"
    Project     = "my-project"
  }
}
```

## 🔑 Inputs

| Name                    | Description                                        | Type          | Default                | Required |
| ----------------------- | -------------------------------------------------- | ------------- | ---------------------- | -------- |
| name                    | Name of the secret                                 | `string`      | n/a                    | ✅ Yes   |
| description             | Description of the secret                          | `string`      | "Managed by Terraform" | ❌ No    |
| recovery_window_in_days | Number of days before AWS can delete the secret    | `number`      | 7                      | ❌ No    |
| kms_key_id              | ARN or ID of the AWS KMS key to encrypt the secret | `string`      | null                   | ❌ No    |
| secret_string           | The secret string to store                         | `string`      | n/a                    | ✅ Yes   |
| tags                    | A map of tags to assign to resources               | `map(string)` | {}                     | ❌ No    |

## 📤 Outputs

| Name              | Description                              |
| ----------------- | ---------------------------------------- |
| secret_arn        | ARN of the created secret                |
| secret_id         | ID of the created secret                 |
| secret_version_id | Version ID of the created secret version |

## 🌍 Notes

- Secret values are marked as sensitive in Terraform and will not be displayed in logs or console output
- For production environments, consider implementing secret rotation using AWS Lambda and the AWS Secrets Manager rotation feature
- Use IAM policies to restrict access to secrets on a need-to-know basis

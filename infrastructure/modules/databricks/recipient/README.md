# 🎫 Delta Sharing Recipient

This module creates a **Delta Sharing recipient**: the identity that reads a share from outside the workspace.

## 📖 Overview

A recipient authenticates either as another Databricks workspace (`DATABRICKS`) or with a bearer token (`TOKEN`) for anything else. This project uses `TOKEN`, because the consumer is the backend service rather than a workspace.

```mermaid
graph LR;
    A[Recipient created] -->|Databricks issues| B[Activation URL]
    B -->|Opened once by operator| C[Credential file]
    C -->|endpoint + bearerToken| D[Stored as app secret]
    D -->|Authenticates| E[Reads from share]

    style A fill:#9C27B0,stroke:#4A148C,color:white,stroke-width:2px
    style B fill:#FF5722,stroke:#BF360C,color:white,stroke-width:2px
    style C fill:#FFC107,stroke:#FF6F00,color:black,stroke-width:2px
    style D fill:#4CAF50,stroke:#1B5E20,color:white,stroke-width:2px
    style E fill:#2196F3,stroke:#0D47A1,color:white,stroke-width:2px
```

## ⚠️ The token is not a Terraform output

This is the module's most important operational constraint. `databricks_recipient` exports `id`, `created_at`, `created_by`, `activation_url`, `expiration_time`, `updated_at` and `updated_by` for each token — **there is no `bearer_token` attribute**.

The token is retrieved out of band: an operator opens `activation_url` and downloads the credential file, which can be [downloaded only once](https://docs.databricks.com/aws/en/opensharing/create-recipient-token). Consequently:

- Terraform cannot populate an application secret with the token. Wiring `try(...tokens[0].bearer_token, ...)` will never resolve.
- The secret holding the token must be written out of band and protected from being overwritten on the next apply (`lifecycle { ignore_changes = [secret_string] }` on the secret resource).
- Tokens expire (a year at most), so rotation is an operational task, not a Terraform one.

## 🛠 Resources Used

| Resource                                                                                                                    | Description                                    |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [**`databricks_recipient`**](https://registry.terraform.io/providers/databricks/databricks/latest/docs/resources/recipient) | Creates the recipient and its activation token |

## ⚙️ Usage

```hcl
module "delta_sharing_recipient" {
  source = "../../modules/databricks/recipient"

  recipient_name      = "open_jii_backend_${var.environment}"
  comment             = "Open JII backend service: Delta Sharing consumer"
  authentication_type = "TOKEN"

  properties = {
    environment = var.environment
    service     = "open-jii-backend"
  }

  providers = {
    databricks.workspace = databricks.workspace
  }
}
```

## 🔑 Inputs

| Name                  | Description                                                  | Type          | Default   | Required |
| --------------------- | ------------------------------------------------------------ | ------------- | --------- | :------: |
| `recipient_name`      | Recipient name; unique per metastore. Lowercase, digits, `_` | `string`      | n/a       |  ✅ Yes  |
| `authentication_type` | `TOKEN` (bearer) or `DATABRICKS` (workspace-to-workspace)    | `string`      | `"TOKEN"` |    No    |
| `comment`             | Free-text description of the recipient                       | `string`      | `null`    |    No    |
| `sharing_code`        | Optional code for recipient self-activation                  | `string`      | `null`    |    No    |
| `properties`          | Metadata key/value pairs attached to the recipient           | `map(string)` | `{}`      |    No    |

## 📤 Outputs

| Name                     | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `recipient_id`           | Unique identifier of the recipient                           |
| `recipient_name`         | Name of the recipient, for grant wiring                      |
| `activation_url`         | One-time URL for downloading the credential file (sensitive) |
| `tokens`                 | Token metadata; contains no bearer token (sensitive)         |
| `authentication_type`    | Configured authentication type                               |
| `recipient_metastore_id` | Metastore the recipient belongs to                           |

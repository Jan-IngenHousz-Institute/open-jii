# 🔑 Delta Sharing Grant

This module grants a **recipient** read access to a **share**. Without it, both exist but no data flows.

## 📖 Overview

The share names the data and the recipient names the reader; the grant is the edge between them. It issues `SELECT` on the share, which is the only privilege Delta Sharing defines for a recipient.

```mermaid
graph LR;
    A[Share] -->|SELECT granted on| C[Grant]
    B[Recipient] -->|granted to| C
    C -->|Enables| D[Recipient reads share]

    style A fill:#4CAF50,stroke:#1B5E20,color:white,stroke-width:2px
    style B fill:#9C27B0,stroke:#4A148C,color:white,stroke-width:2px
    style C fill:#FFC107,stroke:#FF6F00,color:black,stroke-width:2px
    style D fill:#2196F3,stroke:#0D47A1,color:white,stroke-width:2px
```

## 🛠 Resources Used

| Resource                                                                                                              | Description                                   |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| [**`databricks_grants`**](https://registry.terraform.io/providers/databricks/databricks/latest/docs/resources/grants) | Grants `SELECT` on the share to the recipient |

## ⚙️ Usage

```hcl
module "delta_sharing_grant" {
  source = "../../modules/databricks/grant"

  share_name     = module.delta_sharing_share.share_name
  recipient_name = module.delta_sharing_recipient.recipient_name

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.delta_sharing_share, module.delta_sharing_recipient]
}
```

## 🔑 Inputs

| Name             | Description                   | Type     | Default | Required |
| ---------------- | ----------------------------- | -------- | ------- | :------: |
| `share_name`     | Share to grant access to      | `string` | n/a     |  ✅ Yes  |
| `recipient_name` | Recipient receiving the grant | `string` | n/a     |  ✅ Yes  |

## 📤 Outputs

| Name             | Description                       |
| ---------------- | --------------------------------- |
| `grant_id`       | Unique identifier of the grant    |
| `share_name`     | Share the grant applies to        |
| `recipient_name` | Recipient the grant was issued to |

## 💡 Notes

- `databricks_grants` is authoritative for the share it manages: privileges added outside Terraform are removed on the next apply.
- The grant must exist before the recipient can list or read the share, so keep the `depends_on` above.

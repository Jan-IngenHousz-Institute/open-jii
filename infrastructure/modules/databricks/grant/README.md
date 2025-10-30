# 🔑 Delta Sharing Grant Module

This module **grants a recipient access to a Delta share** in Databricks Unity Catalog. A grant links a recipient to a share, enabling the recipient to access the shared data using Delta Sharing protocol.

## 📖 Overview

Grants are the connection between shares (collections of data) and recipients (data consumers). Once a grant is created, the recipient can use their bearer token or OAuth credentials to query the shared tables via the Delta Sharing protocol.

### Key Concepts:
- **Grant**: Permission linking a recipient to a share
- **Share**: The data being shared (created via share module)
- **Recipient**: The entity receiving access (created via recipient module)
- **Access Control**: Grants can be revoked by deleting the grant resource

## 🛠 Resources Used

| Resource            | Description                                    | Documentation                                                                                          |
| ------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `databricks_grant`  | Grants recipient access to a share             | [Databricks Grant](https://registry.terraform.io/providers/databricks/databricks/latest/docs/resources/grant) |

## ⚙️ Usage

### Basic Grant

```hcl
module "research_grant" {
  source = "../../modules/databricks/grant"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name     = "research_experiment_data"
  recipient_name = "university_research_lab"
}
```

### Grant Using Module Outputs

```hcl
# Create share
module "experiment_share" {
  source = "../../modules/databricks/share"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name = "photophysiology_data"
  
  tables = [
    {
      name = "open_jii_prod.experiments.measurements"
    }
  ]
}

# Create recipient
module "partner_recipient" {
  source = "../../modules/databricks/recipient"

  providers = {
    databricks.workspace = databricks.workspace
  }

  recipient_name = "research_partner"
  comment        = "External research partner"
}

# Grant access
module "access_grant" {
  source = "../../modules/databricks/grant"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name     = module.experiment_share.share_name
  recipient_name = module.partner_recipient.recipient_name
}
```

### Multiple Recipients for One Share

```hcl
# One share
module "experiment_share" {
  source = "../../modules/databricks/share"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name = "public_research_data"
  
  tables = [
    {
      name = "catalog.schema.measurements"
    }
  ]
}

# Multiple recipients
module "partner_a" {
  source = "../../modules/databricks/recipient"

  providers = {
    databricks.workspace = databricks.workspace
  }

  recipient_name = "partner_a"
}

module "partner_b" {
  source = "../../modules/databricks/recipient"

  providers = {
    databricks.workspace = databricks.workspace
  }

  recipient_name = "partner_b"
}

# Grant access to both
module "grant_a" {
  source = "../../modules/databricks/grant"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name     = module.experiment_share.share_name
  recipient_name = module.partner_a.recipient_name
}

module "grant_b" {
  source = "../../modules/databricks/grant"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name     = module.experiment_share.share_name
  recipient_name = module.partner_b.recipient_name
}
```

### Multiple Shares for One Recipient

```hcl
# One recipient
module "analytics_partner" {
  source = "../../modules/databricks/recipient"

  providers = {
    databricks.workspace = databricks.workspace
  }

  recipient_name = "analytics_vendor"
}

# Multiple shares
module "share_2023" {
  source = "../../modules/databricks/share"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name = "data_2023"
  
  tables = [
    { name = "catalog.schema.measurements_2023" }
  ]
}

module "share_2024" {
  source = "../../modules/databricks/share"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name = "data_2024"
  
  tables = [
    { name = "catalog.schema.measurements_2024" }
  ]
}

# Grant access to both shares
module "grant_2023" {
  source = "../../modules/databricks/grant"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name     = module.share_2023.share_name
  recipient_name = module.analytics_partner.recipient_name
}

module "grant_2024" {
  source = "../../modules/databricks/grant"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name     = module.share_2024.share_name
  recipient_name = module.analytics_partner.recipient_name
}
```

## 🔑 Inputs

| Name           | Description                                  | Type     | Default | Required |
| -------------- | -------------------------------------------- | -------- | ------- | -------- |
| share_name     | Name of the share to grant access to         | `string` | n/a     | ✅ Yes   |
| recipient_name | Name of the recipient receiving access       | `string` | n/a     | ✅ Yes   |

## 📤 Outputs

| Name           | Description                                        |
| -------------- | -------------------------------------------------- |
| grant_id       | The unique identifier of the grant                 |
| share_name     | The name of the share for which access was granted |
| recipient_name | The name of the recipient who was granted access   |

## 🔗 Integration with Other Modules

This module **requires** both:

1. **Share Module** (`databricks/share`) - Creates the share being granted
2. **Recipient Module** (`databricks/recipient`) - Creates the recipient receiving access

### Complete Workflow

```hcl
# 1. Create catalog and schema (prerequisite)
module "catalog" {
  source = "../../modules/databricks/catalog"
  # ... catalog configuration
}

module "schema" {
  source = "../../modules/databricks/schema"
  # ... schema configuration
}

# 2. Create share with tables
module "data_share" {
  source = "../../modules/databricks/share"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name = "experiment_data"
  
  tables = [
    {
      name    = "${module.catalog.catalog_name}.${module.schema.schema_name}.measurements"
      comment = "Sensor measurements"
    }
  ]

  depends_on = [module.schema]
}

# 3. Create recipient
module "external_recipient" {
  source = "../../modules/databricks/recipient"

  providers = {
    databricks.workspace = databricks.workspace
  }

  recipient_name       = "partner_org"
  allowed_ip_addresses = ["203.0.113.0/24"]
}

# 4. Grant access (this module)
module "data_grant" {
  source = "../../modules/databricks/grant"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name     = module.data_share.share_name
  recipient_name = module.external_recipient.recipient_name

  depends_on = [
    module.data_share,
    module.external_recipient
  ]
}
```

## 🔒 Security & Access Control

### Granting Access

When a grant is created:
- ✅ Recipient can immediately access all tables in the share
- ✅ Recipient uses their bearer token to authenticate
- ✅ Access follows IP restrictions set on the recipient (if any)
- ✅ Activity is logged in Databricks audit logs

### Revoking Access

To revoke access, simply destroy the grant resource:

```bash
terraform destroy -target=module.data_grant
```

This will:
- ❌ Immediately revoke recipient's access to the share
- ✅ Preserve the share (other recipients can still access it)
- ✅ Preserve the recipient (they can still access other shares)

### Access Patterns

**Temporary Access**:
```hcl
# Grant access for a limited time, then revoke
module "temp_grant" {
  source         = "../../modules/databricks/grant"
  share_name     = "temporary_share"
  recipient_name = "temp_recipient"
  
  # Use lifecycle or external automation to destroy after X days
}
```

**Staged Rollout**:
```hcl
# Grant access to dev share first, then prod
module "dev_grant" {
  source         = "../../modules/databricks/grant"
  share_name     = "dev_data_share"
  recipient_name = "new_partner"
}

module "prod_grant" {
  source         = "../../modules/databricks/grant"
  share_name     = "prod_data_share"
  recipient_name = "new_partner"
  
  # Only create after dev testing is complete
  count = var.promote_to_prod ? 1 : 0
}
```

## 📋 Prerequisites

- Share must exist (via share module)
- Recipient must exist (via recipient module)
- Appropriate permissions to manage grants in the metastore

## ⚠️ Important Notes

- Grants take effect immediately
- One grant per share-recipient pair
- Deleting a grant immediately revokes access
- Deleting a share automatically deletes all its grants
- Deleting a recipient automatically deletes all their grants
- Grant access is audited in Databricks Unity Catalog audit logs

## 🔍 Access Verification

After creating a grant, verify access:

### From Databricks UI:
1. Navigate to **Data** > **Delta Sharing** > **Shares**
2. Select your share
3. View **Recipients** tab
4. Verify recipient is listed with access

### From Recipient Side:
```python
# Recipient can test access using Delta Sharing client
import delta_sharing

# Load credential file
profile_file = "/path/to/credential.share"
client = delta_sharing.SharingClient(profile_file)

# List available shares
shares = client.list_shares()

# List tables in share
tables = client.list_tables(share_name)

# Query data
df = delta_sharing.load_as_pandas(f"{profile_file}#share.schema.table")
```

## 📚 Related Documentation

- [Delta Sharing Access Control](https://docs.databricks.com/data-sharing/grant-access.html)
- [Managing Recipients](https://docs.databricks.com/data-sharing/manage-recipients.html)
- [Audit Logs](https://docs.databricks.com/administration-guide/account-settings/audit-logs.html)

## 🤝 Contributing

When making changes to this module:
1. Update examples in this README
2. Test grant creation and revocation
3. Validate Terraform syntax with `terraform validate`
4. Verify grants in Databricks UI
5. Run `terraform fmt` to maintain consistent formatting

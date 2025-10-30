# 📊 Delta Sharing Share Module

This module creates a **Delta Sharing share** in Databricks Unity Catalog. A share is a named collection of schemas that you want to share with external recipients using the Delta Sharing protocol.

## 📖 Overview

Delta Sharing is an open protocol for secure data sharing. A **share** allows you to share entire schemas (databases) from your Unity Catalog with external users or systems. Recipients can then access this shared data using the Delta Sharing protocol without needing direct access to your Databricks workspace.

### Key Concepts

- **Share**: A logical container for sharing data
- **Schema**: One or more schemas (databases) being shared
- **Automatic Updates**: Recipients automatically get access to new tables/views added to shared schemas
- **History**: Tables shared via schemas always include full history
- **Hybrid Management**: Static schemas via Terraform + Dynamic schemas via Python SDK

## 🛠 Resources Used

| Resource              | Description                                    | Documentation                                                                                          |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `databricks_share`    | Creates a Delta Sharing share object           | [Databricks Share](https://registry.terraform.io/providers/databricks/databricks/latest/docs/resources/share) |

## 🔄 Hybrid Schema Management

This module supports **two ways** to add schemas to a share:

### 1. Terraform (Static Schemas) 
Use for schemas that exist at plan time (e.g., `central`, `analytics`):
```hcl
schemas = [
  { name = "central", comment = "Centralized cleaned data" }
]
```

### 2. Python SDK (Dynamic Schemas)
Use for schemas created at runtime (e.g., experiment schemas):
```python
# Automatically added by experiment_pipeline_create_task.py
manager.add_schema_to_share(config)
```

**Important**: The module uses `lifecycle.ignore_changes` on the `object` block, so Terraform won't overwrite schemas added programmatically.

## ⚙️ Usage

### Share with Static and Dynamic Schemas

```hcl
module "jii_data_share" {
  source = "../../modules/databricks/share"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name   = "jii_experiment_data_share"
  catalog_name = "jii_dev"
  comment      = "Open JII experimental and analytical data for external partners"

  # Static schemas (known at Terraform plan time)
  schemas = [
    {
      name    = "central"
      comment = "Centralized cleaned sensor data from all devices"
    }
  ]
  
  # Dynamic schemas (e.g., exp_photosynthesis_exp001) are added at runtime
  # by the experiment_pipeline_create_task.py notebook
}
```

### Share with Only Dynamic Schemas

```hcl
module "experiment_only_share" {
  source = "../../modules/databricks/share"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name   = "experiment_data_share"
  catalog_name = "jii_prod"
  comment      = "Experiment schemas added dynamically at runtime"

  # Empty list - all schemas added via Python SDK
  schemas = []
}
```

### Share Multiple Static Schemas

```hcl
module "multi_schema_share" {
  source = "../../modules/databricks/share"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name   = "research_collaboration"
  catalog_name = "open_jii_prod"
  comment      = "Multiple analytics schemas shared with partners"

  schemas = [
    {
      name    = "analytics_daily"
      comment = "Daily aggregated analytics"
    },
    {
      name    = "analytics_monthly"
      comment = "Monthly aggregated analytics"
    },
    {
      name    = "ml_features"
      comment = "Processed ML feature tables"
    }
  ]
}
```
```

### Share with Partition Filtering

```hcl
module "filtered_share" {
  source = "../../modules/databricks/share"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name   = "filtered_experiment_data"
  catalog_name = "open_jii_dev"

  tables = [
    {
      schema_name = "exp_multiyear_004"
      table_name  = "yearly_measurements"
      comment     = "Only share data from 2024"
      partitions = [
        {
          values = [
            {
              name  = "year"
              op    = "EQUAL"
              value = "2024"
            }
## 🔑 Inputs

| Name         | Description                                                                 | Type           | Default | Required |
| ------------ | --------------------------------------------------------------------------- | -------------- | ------- | -------- |
| share_name   | Name of the Delta Sharing share (lowercase, numbers, underscores only)      | `string`       | n/a     | ✅ Yes   |
| catalog_name | Name of the catalog containing the schemas to share                         | `string`       | n/a     | ✅ Yes   |
| comment      | Optional description of the share's purpose                                 | `string`       | `null`  | ❌ No    |
| schemas      | List of static schemas to include (dynamic schemas added via Python SDK)    | `list(object)` | `[]`    | ❌ No    |

### Schema Object Structure

Each schema in the `schemas` list supports:

| Field   | Description                          | Type     | Required |
| ------- | ------------------------------------ | -------- | -------- |
| name    | Schema name within the catalog       | `string` | ✅ Yes   |
| comment | Description of what's being shared   | `string` | ❌ No    |

**Note**: The `schemas` list can be empty if you only use dynamic schema registration via Python SDK.

## 📤 Outputs

| Name       | Description                                               |
| ---------- | --------------------------------------------------------- |
| share_id   | The unique identifier of the created share                |
| share_name | The name of the created share                             |
| share_url  | Information about accessing the share (requires recipient) |

## 🔗 Integration with Other Modules

This module works in conjunction with:

1. **Recipient Module** (`databricks/recipient`) - Creates recipients who can access this share
2. **Grant Module** (`databricks/grant`) - Grants recipient access to this share
3. **Catalog Module** (`databricks/catalog`) - Provides the source catalog
4. **Schema Module** (`databricks/schema`) - Provides the source schemas

### Complete Workflow Example

```hcl
# 1. Create the share
module "research_share" {
  source = "../../modules/databricks/share"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name   = "research_collaboration"
  catalog_name = "open_jii_prod"
  comment      = "Shared schemas for external research collaboration"

  schemas = [
    {
      name    = "experiments_2024"
      comment = "2024 measurement data"
    }
  ]
}

# 2. Create a recipient
module "partner_recipient" {
  source = "../../modules/databricks/recipient"

  providers = {
    databricks.workspace = databricks.workspace
  }

  recipient_name = "research_partner_university"
  comment        = "University research partner"
}

# 3. Grant access
module "research_grant" {
  source = "../../modules/databricks/grant"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name     = module.research_share.share_name
  recipient_name = module.partner_recipient.recipient_name
}
```

## � Security Best Practices

1. **Principle of Least Privilege**: Only share the minimum necessary schemas
2. **Schema Organization**: Organize data into schemas by sensitivity/audience
3. **Access Auditing**: Monitor share usage through Databricks audit logs
4. **Regular Review**: Periodically review and update what schemas are shared
5. **Naming Conventions**: Use clear, descriptive schema names for recipients

## 📋 Prerequisites

- Databricks Unity Catalog enabled
- Appropriate permissions to create shares in the workspace
- Source schemas must exist in the specified catalog
- Tables must be in Delta format for Delta Sharing

## 🚀 Key Features

### Automatic Updates

When you share a schema, recipients automatically get access to:
- All existing tables, views, and volumes in the schema
- Any new tables, views, or volumes added to the schema in the future
- Full table history (time travel support)

### Limitations

⚠️ **Note**: When sharing entire schemas:
- Table aliases are not available
- Partition filtering is not available  
- Tables automatically include full history

If you need these features, share individual tables instead of schemas.

## ⚠️ Important Notes

- Share names must be unique within the metastore
- Schema names are qualified with catalog: `catalog.schema`
- Recipients need appropriate authentication (bearer tokens or OAuth)
- Deleting a share will revoke access for all recipients
- Cannot share catalogs directly - only schemas within catalogs

## 📚 Related Documentation

- [Delta Sharing Protocol](https://github.com/delta-io/delta-sharing)
- [Databricks Delta Sharing](https://docs.databricks.com/data-sharing/index.html)
- [Unity Catalog Schemas](https://docs.databricks.com/data-governance/unity-catalog/index.html)
- [Share Schemas](https://docs.databricks.com/delta-sharing/create-share.html#add-schemas-to-a-share)

## 🤝 Contributing

When making changes to this module:
1. Update examples in this README
2. Test with actual Databricks workspace
3. Validate Terraform syntax with `terraform validate`
4. Run `terraform fmt` to maintain consistent formatting

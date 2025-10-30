# 👤 Delta Sharing Recipient Module

This module creates a **Delta Sharing recipient** in Databricks Unity Catalog. A recipient represents an external data consumer who will be granted access to one or more Delta shares.

## 📖 Overview

Recipients are entities (users, organizations, or systems) that receive access to shared data via the Delta Sharing protocol. When you create a recipient, Databricks generates authentication credentials (bearer tokens) and an activation URL that the recipient can use to access shared data.

### Key Concepts:
- **Recipient**: An entity authorized to access Delta shares
- **Authentication**: TOKEN (bearer token) or DATABRICKS (OAuth)
- **Activation**: Recipients download credential files via activation URL
- **Bearer Tokens**: Authentication credentials for Delta Sharing protocol access

## 🛠 Resources Used

| Resource                 | Description                                    | Documentation                                                                                          |
| ------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `databricks_recipient`   | Creates a Delta Sharing recipient              | [Databricks Recipient](https://registry.terraform.io/providers/databricks/databricks/latest/docs/resources/recipient) |

## ⚙️ Usage

### Basic Recipient with Token Authentication

```hcl
module "research_partner" {
  source = "../../modules/databricks/recipient"

  providers = {
    databricks.workspace = databricks.workspace
  }

  recipient_name = "university_research_lab"
  comment        = "Research partner at University Lab"
}
```

### Recipient with IP Restrictions

```hcl
module "restricted_partner" {
  source = "../../modules/databricks/recipient"

  providers = {
    databricks.workspace = databricks.workspace
  }

  recipient_name = "secure_partner"
  comment        = "Partner with IP-restricted access"

  allowed_ip_addresses = [
    "203.0.113.0/24",     # Partner's office network
    "198.51.100.42/32"    # Partner's VPN endpoint
  ]
}
```

### Recipient with Custom Properties

```hcl
module "tagged_recipient" {
  source = "../../modules/databricks/recipient"

  providers = {
    databricks.workspace = databricks.workspace
  }

  recipient_name = "analytics_vendor"
  comment        = "Third-party analytics vendor"

  properties = {
    organization = "AnalyticsCorp"
    contact      = "data-team@analyticscorp.example"
    environment  = "production"
    project_id   = "PROJ-12345"
  }
}
```

### Recipient with OAuth Authentication

```hcl
module "oauth_recipient" {
  source = "../../modules/databricks/recipient"

  providers = {
    databricks.workspace = databricks.workspace
  }

  recipient_name      = "internal_analytics_team"
  comment             = "Internal team using OAuth authentication"
  authentication_type = "DATABRICKS"
}
```

## 🔑 Inputs

| Name                  | Description                                                                     | Type           | Default   | Required |
| --------------------- | ------------------------------------------------------------------------------- | -------------- | --------- | -------- |
| recipient_name        | Name of the recipient (lowercase, numbers, underscores only)                    | `string`       | n/a       | ✅ Yes   |
| comment               | Optional description of the recipient                                           | `string`       | `null`    | ❌ No    |
| authentication_type   | Authentication type: TOKEN (bearer token) or DATABRICKS (OAuth)                 | `string`       | `"TOKEN"` | ❌ No    |
| sharing_code          | Optional sharing code for recipient self-activation                             | `string`       | `null`    | ❌ No    |
| allowed_ip_addresses  | List of allowed IP addresses in CIDR notation. Empty list = no restrictions     | `list(string)` | `[]`      | ❌ No    |
| properties            | Optional map of custom properties/metadata for the recipient                    | `map(string)`  | `{}`      | ❌ No    |

## 📤 Outputs

| Name                   | Description                                                           | Sensitive |
| ---------------------- | --------------------------------------------------------------------- | --------- |
| recipient_id           | The unique identifier of the created recipient                        | No        |
| recipient_name         | The name of the created recipient                                     | No        |
| activation_url         | URL for the recipient to download their credential file               | Yes       |
| tokens                 | Bearer token(s) for authentication                                    | Yes       |
| authentication_type    | The authentication type configured                                    | No        |
| recipient_metastore_id | The metastore ID where the recipient is registered                    | No        |

## 🔗 Integration with Other Modules

This module works in conjunction with:

1. **Share Module** (`databricks/share`) - Defines what data to share
2. **Grant Module** (`databricks/grant`) - Grants this recipient access to specific shares

### Complete Workflow Example

```hcl
# 1. Create a share with data
module "experiment_share" {
  source = "../../modules/databricks/share"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name = "research_data"

  tables = [
    {
      name    = "catalog.schema.measurements"
      comment = "Experiment measurements"
    }
  ]
}

# 2. Create a recipient
module "partner_recipient" {
  source = "../../modules/databricks/recipient"

  providers = {
    databricks.workspace = databricks.workspace
  }

  recipient_name = "research_partner"
  comment        = "External research partner"

  allowed_ip_addresses = ["203.0.113.0/24"]
}

# 3. Grant the recipient access to the share
module "research_grant" {
  source = "../../modules/databricks/grant"

  providers = {
    databricks.workspace = databricks.workspace
  }

  share_name     = module.experiment_share.share_name
  recipient_name = module.partner_recipient.recipient_name
  privileges     = ["SELECT"]
}

# 4. Store bearer token securely
resource "aws_secretsmanager_secret" "recipient_token" {
  name        = "databricks/recipient/${module.partner_recipient.recipient_name}/token"
  description = "Bearer token for ${module.partner_recipient.recipient_name}"
}

resource "aws_secretsmanager_secret_version" "recipient_token" {
  secret_id     = aws_secretsmanager_secret.recipient_token.id
  secret_string = jsonencode({
    activation_url = module.partner_recipient.activation_url
    tokens         = module.partner_recipient.tokens
  })
}
```

## 🔒 Security Best Practices

1. **Token Management**:
   - Store bearer tokens securely (AWS Secrets Manager, Vault, etc.)
   - Rotate tokens periodically
   - Never commit tokens to version control

2. **IP Restrictions**:
   - Use `allowed_ip_addresses` to limit access to known networks
   - Use /32 CIDR for single IP addresses
   - Document why each IP range is allowed

3. **Authentication Type**:
   - Use TOKEN authentication for external recipients
   - Use DATABRICKS (OAuth) for internal recipients with existing Databricks accounts

4. **Activation URLs**:
   - Activation URLs contain sensitive credentials
   - Share activation URLs securely (encrypted channels)
   - URLs should be single-use when possible

5. **Access Auditing**:
   - Monitor recipient activity through Databricks audit logs
   - Set up alerts for unusual access patterns
   - Regularly review and revoke unused recipients

## 📋 Prerequisites

- Databricks Unity Catalog enabled
- Appropriate permissions to create recipients in the metastore
- Network firewall rules configured (if using IP restrictions)
- Secure credential storage solution for bearer tokens

## 🚀 After Creation

### For the Data Provider (You):

1. **Retrieve Credentials**: Access outputs (sensitive) containing activation_url and tokens
2. **Store Securely**: Save credentials in secure storage (Secrets Manager, Vault)
3. **Share with Recipient**: Send activation URL to the recipient via secure channel
4. **Grant Access**: Use the grant module to give recipient access to specific shares

### For the Recipient:

1. **Download Credentials**: Visit the activation URL to download credential file
2. **Configure Client**: Set up Delta Sharing client with downloaded credentials
3. **Access Data**: Query shared data using Delta Sharing protocol

Example credential file (generated by Databricks):
```json
{
  "shareCredentialsVersion": 1,
  "endpoint": "https://your-workspace.cloud.databricks.com/api/2.1/unity-catalog/shares",
  "bearerToken": "generated-token-here"
}
```

## ⚠️ Important Notes

- Recipient names must be unique within the metastore
- Bearer tokens are generated automatically and output as sensitive values
- Deleting a recipient revokes all their access immediately
- IP restrictions apply to all shares the recipient can access
- Activation URLs may expire based on workspace configuration

## 🛡️ Access Patterns

### External Partner (Recommended)
```hcl
authentication_type = "TOKEN"
allowed_ip_addresses = ["partner-ip-range"]
```

### Internal Team
```hcl
authentication_type = "DATABRICKS"  # Use OAuth
allowed_ip_addresses = []           # Trust internal network
```

### Highly Restricted
```hcl
authentication_type = "TOKEN"
allowed_ip_addresses = ["single-ip/32"]  # Specific machine only
```

## 📚 Related Documentation

- [Delta Sharing Protocol](https://github.com/delta-io/delta-sharing)
- [Databricks Recipients](https://docs.databricks.com/data-sharing/create-recipient.html)
- [Delta Sharing Security](https://docs.databricks.com/data-sharing/security.html)

## 🤝 Contributing

When making changes to this module:
1. Update examples in this README
2. Test authentication flows with actual recipients
3. Validate Terraform syntax with `terraform validate`
4. Never commit actual bearer tokens or activation URLs
5. Run `terraform fmt` to maintain consistent formatting

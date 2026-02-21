# Delta Sharing — Infrastructure as Code (Terraform)

> These notes capture the Terraform resources required to enable **Delta Sharing**
> between the Databricks workspace (provider) and the Open‑JII backend (recipient).
> Implementation will follow once the backend mock endpoint is validated.

---

## 1. Resources to Create

### `databricks_metastore`

Enable Delta Sharing at the metastore level.

```hcl
resource "databricks_metastore" "this" {
  name                           = "open-jii-metastore"
  storage_root                   = "s3://${var.bucket}/metastore"
  delta_sharing_scope            = "INTERNAL_AND_EXTERNAL"
  delta_sharing_recipient_token_lifetime_in_seconds = 86400
  delta_sharing_organization_name = var.org_name
  force_destroy                  = false
}
```

### `databricks_share`

One share per experiment (maps to the `exp_{name}_{id}` pattern used in `DeltaAdapter.buildShareSchema()`).

```hcl
resource "databricks_share" "experiment" {
  name = "exp_${var.experiment_name}_${var.experiment_id}"

  object {
    name                        = "${var.catalog}.${var.schema}.experiment_raw_data"
    data_object_type            = "TABLE"
    history_data_sharing_status = "ENABLED"
  }
}
```

### `databricks_recipient`

The backend service authenticates with a bearer token.

```hcl
resource "databricks_recipient" "backend" {
  name                = "open-jii-backend"
  authentication_type = "TOKEN"
  sharing_code        = var.sharing_code          # one-time activation
  ip_access_list {
    allowed_ip_addresses = var.backend_ip_allowlist
  }
}
```

After creation, Databricks generates an **activation link** → download the
credential file (contains `bearerToken` + `endpoint`) → store as
`DELTA_BEARER_TOKEN` / `DELTA_ENDPOINT` env vars.

### `databricks_grants`

Grant the recipient `SELECT` on the share.

```hcl
resource "databricks_grants" "share_to_backend" {
  share = databricks_share.experiment.name

  grant {
    principal  = databricks_recipient.backend.name
    privileges = ["SELECT"]
  }
}
```

### `databricks_catalog` (for provider‑side, if using Unity Catalog sharing)

```hcl
resource "databricks_catalog" "shared" {
  name          = "open_jii_shared"
  provider_name = databricks_provider.this.name
  share_name    = databricks_share.experiment.name
  comment       = "Catalog backed by Delta Share for backend consumption"
}
```

### `databricks_provider`

Only needed when the **recipient** workspace also runs Databricks and uses
Databricks‑to‑Databricks sharing. Skip if the backend only speaks REST.

```hcl
resource "databricks_provider" "this" {
  name                      = "open-jii-provider"
  authentication_type       = "TOKEN"
  recipient_profile_str     = file("${path.module}/recipient_profile.json")
  comment                   = "Provider for open-jii backend"
}
```

---

## 2. Existing Terraform Modules (in `infrastructure/modules/`)

| Module          | Relevant? | Notes                                         |
| --------------- | --------- | --------------------------------------------- |
| `databricks/`   | ✅ Yes    | Add share / recipient / grants resources here |
| `metastore-s3/` | ✅ Yes    | Already provisions metastore S3 bucket        |
| `iam-oidc/`     | Maybe     | If backend uses OIDC instead of static token  |
| `ecs/`          | Ref       | IP allowlist source for recipient             |

---

## 3. Environment Variables

| Variable                | Source                    | Example                                                          |
| ----------------------- | ------------------------- | ---------------------------------------------------------------- |
| `DELTA_ENDPOINT`        | Recipient credential file | `https://<workspace>.cloud.databricks.com/api/2.0/delta-sharing` |
| `DELTA_BEARER_TOKEN`    | Recipient credential file | `dapi…`                                                          |
| `DELTA_REQUEST_TIMEOUT` | Hardcoded / config        | `30000`                                                          |
| `DELTA_MAX_RETRIES`     | Hardcoded / config        | `3`                                                              |

---

## 4. Roll‑out Steps

1. Enable Delta Sharing on the metastore (`delta_sharing_scope`).
2. `terraform apply` the `databricks_share` + `databricks_recipient` + `databricks_grants`.
3. Download the activation link / credential file.
4. Inject `DELTA_ENDPOINT` + `DELTA_BEARER_TOKEN` into the ECS task definition (via SSM / Secrets Manager).
5. Switch experiment data repository from `DATABRICKS_PORT` to `DELTA_PORT`.
6. Remove mock controller once verified in staging.

terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      configuration_aliases = [databricks.workspace]
    }
  }
}

resource "databricks_cluster_policy" "this" {
  provider = databricks.workspace

  name       = var.name
  definition = var.definition

  description                        = var.description
  policy_family_id                   = var.policy_family_id
  policy_family_definition_overrides = var.policy_family_definition_overrides
  max_clusters_per_user              = var.max_clusters_per_user

  dynamic "libraries" {
    for_each = var.libraries
    content {
      jar = try(libraries.value.jar, null)
      whl = try(libraries.value.whl, null)

      pypi {
        package = try(libraries.value.pypi.package, null)
        repo    = try(libraries.value.pypi.repo, null)
      }
      maven {
        coordinates = try(libraries.value.maven.coordinates, null)
        repo        = try(libraries.value.maven.repo, null)
        exclusions  = try(libraries.value.maven.exclusions, null)
      }
      cran {
        package = try(libraries.value.cran.package, null)
        repo    = try(libraries.value.cran.repo, null)
      }
    }
  }
}

# Grant cluster policy permissions to principals if provided
resource "databricks_permissions" "cluster_policy" {
  count             = length(var.permissions) > 0 ? 1 : 0
  provider          = databricks.workspace
  cluster_policy_id = databricks_cluster_policy.this.id

  dynamic "access_control" {
    for_each = var.permissions
    content {
      user_name              = try(access_control.value.user_name, null)
      group_name             = try(access_control.value.group_name, null)
      service_principal_name = try(access_control.value.service_principal_name, null)
      permission_level       = access_control.value.permission_level
    }
  }
}

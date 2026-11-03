terraform {
  required_version = ">= 1.11.0"

  required_providers {
    databricks = {
      source  = "databricks/databricks"
      version = ">=1.72.0"
    }

    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }

    grafana = {
      source  = "grafana/grafana"
      version = ">= 4.2.1"
    }

    random = {
      source  = "hashicorp/random"
      version = ">= 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# DR provider alias — used by modules that create cross-region resources
provider "aws" {
  alias  = "dr"
  region = var.dr_region
}

provider "databricks" {
  alias         = "mws"
  host          = "https://accounts.cloud.databricks.com"
  account_id    = var.databricks_account_id
  client_id     = var.databricks_client_id
  client_secret = var.databricks_client_secret
  auth_type     = var.databricks_auth_type
}

provider "databricks" {
  alias         = "workspace"
  host          = var.databricks_host
  client_id     = var.databricks_client_id
  client_secret = var.databricks_client_secret
  auth_type     = var.databricks_auth_type
  # The federation policies accept the account ID, not the workspace's token endpoint.
  audience = var.databricks_account_id
}


provider "grafana" {
  alias = "amg"
  url   = module.managed_grafana_workspace.amg_url
  auth  = var.grafana_auth_service_token
}

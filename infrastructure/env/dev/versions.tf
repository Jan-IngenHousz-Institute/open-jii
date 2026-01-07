terraform {
  required_version = ">= 1.5.6"

  required_providers {
    databricks = {
      source  = "databricks/databricks"
      version = ">=1.13.0"
    }

    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    grafana = {
      source  = "grafana/grafana"
      version = ">= 4.2.1"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "databricks" {
  alias         = "mws"
  host          = "https://accounts.cloud.databricks.com"
  account_id    = var.databricks_account_id
  client_id     = var.databricks_client_id
  client_secret = var.databricks_client_secret
  auth_type     = "oauth-m2m"
}

provider "databricks" {
  alias         = "workspace"
  host          = var.databricks_host
  client_id     = var.databricks_client_id
  client_secret = var.databricks_client_secret
  auth_type     = "oauth-m2m"
}

provider "grafana" {
  alias = "amg"
  url   = module.managed_grafana_workspace.amg_url
  auth  = module.managed_grafana_workspace.service_account_token
}

terraform {
  required_version = ">= 1.5.6"

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

    posthog = {
      source  = "posthog/posthog"
      version = ">= 1.0.21"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# DR provider alias — required by the S3 module (configuration_aliases).
# Dev has no DR features enabled; this alias is wiring only.
provider "aws" {
  alias  = "dr"
  region = "eu-west-1"
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
  auth  = var.grafana_auth_service_token
}

# The one openJII project, which every environment shares; posthog.tf says why it is applied here.
provider "posthog" {
  host       = "https://eu.posthog.com"
  project_id = "80726"
  api_key    = var.posthog_tofu_api_key
}

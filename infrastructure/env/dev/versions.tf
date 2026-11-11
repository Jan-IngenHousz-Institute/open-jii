terraform {
  required_version = ">= 1.11.0"

  required_providers {
    databricks = {
      source  = "databricks/databricks"
      version = "~> 1.142"
    }

    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.72"
    }
    grafana = {
      source  = "grafana/grafana"
      version = "~> 4.54"
    }

    posthog = {
      source  = "posthog/posthog"
      version = "~> 1.0"
    }

    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }

    time = {
      source  = "hashicorp/time"
      version = "~> 0.14"
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

# The one openJII project, which every environment shares; posthog.tf says why it is applied here.
provider "posthog" {
  host       = "https://eu.posthog.com"
  project_id = "80726"
  api_key    = var.posthog_tofu_api_key
}

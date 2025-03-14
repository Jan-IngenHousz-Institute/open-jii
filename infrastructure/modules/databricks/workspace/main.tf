terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.mws, databricks.workspace]

    }
  }
}

data "databricks_aws_assume_role_policy" "this" {
  external_id = var.databricks_account_id
}

data "databricks_aws_crossaccount_policy" "this" {}

resource "aws_iam_role" "cross_account_role" {
  name               = "open-jii-databricks-crossaccount-role-dev"
  assume_role_policy = data.databricks_aws_assume_role_policy.this.json
}

resource "aws_iam_role_policy" "this" {
  name   = "open-jii-databricks-s3-policy-dev"
  role   = aws_iam_role.cross_account_role.id
  policy = data.databricks_aws_crossaccount_policy.this.json
}

resource "databricks_mws_networks" "this" {
  provider           = databricks.mws
  account_id         = var.databricks_account_id
  network_name       = "open-jii-mws-network-dev"
  security_group_ids = [var.sg_id]
  subnet_ids         = var.private_subnets
  vpc_id             = var.vpc_id
}

resource "databricks_mws_storage_configurations" "this" {
  provider                   = databricks.mws
  account_id                 = var.databricks_account_id
  bucket_name                = var.bucket_name
  storage_configuration_name = "open-jii-mws-storage-configuration-dev"
}

resource "databricks_mws_credentials" "this" {
  provider         = databricks.mws
  role_arn         = aws_iam_role.cross_account_role.arn
  credentials_name = "open-jii-mws-creds-dev"
}

resource "databricks_mws_workspaces" "this" {
  provider       = databricks.mws
  account_id     = var.databricks_account_id
  aws_region     = var.aws_region
  workspace_name = "open-jii-databricks-workspace-dev"

  credentials_id           = databricks_mws_credentials.this.credentials_id
  storage_configuration_id = databricks_mws_storage_configurations.this.storage_configuration_id
  network_id               = databricks_mws_networks.this.network_id

  token {}
}

resource "databricks_credential" "kinesis" {
  name     = var.kinesis_role_name
  provider = databricks.workspace
  aws_iam_role {
    role_arn = var.kinesis_role_arn
  }
  purpose = "SERVICE"
  comment = "Kinesis access credential managed by Terraform"
}
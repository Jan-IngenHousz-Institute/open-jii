module "terraform_state_s3" {
  source      = "../modules/s3"
  bucket_name = "open-jii-terraform-state-data-governance"
}

module "terraform_state_lock" {
  source     = "../modules/dynamodb"
  table_name = "terraform-state-lock"
}

# # module "iam_oidc" {
# #   source     = "../../modules/iam-oidc"
# #   role_name  = "GithubActionsDeployAccess"
# #   repository = "Jan-IngenHousz-Institute/open-jii"
# #   branch     = "main"
# #   aws_region = var.aws_region
# # }

# Centralized Unity Catalog Metastore S3 Storage
# This creates the S3 bucket and IAM resources for the metastore
module "metastore_s3" {
  source      = "../modules/metastore-s3"
  bucket_name = "open-jii-databricks-uc-${var.aws_region}-metastore"

  # Cross-account role ARNs that should have access to this bucket
  cross_account_role_arns = [
    for env, account in var.accounts : 
    "arn:aws:iam::${account.account_id}:role/open-jii-${env}-uc-access"
  ]

  providers = {
    databricks.mws = databricks.mws
  }
}

# Centralized Unity Catalog Metastore
# This will be shared across dev and prod workspaces
module "databricks_metastore" {
  source         = "../modules/databricks/metastore"
  metastore_name = "open_jii_metastore_aws_eu_central_1"
  region         = var.aws_region
  owner          = "account users"

  # Workspace IDs derived from workspaces map
  workspace_ids = [for ws in var.workspaces : ws.workspace_id]

  providers = {
    databricks.mws = databricks.mws
  }

  depends_on = [module.metastore_s3]
}

# output "metastore_id" {
#   description = "The ID of the Unity Catalog metastore"
#   value       = module.databricks_metastore.metastore_id
# }

# output "metastore_name" {
#   description = "The name of the Unity Catalog metastore"
#   value       = module.databricks_metastore.metastore_name
# }

# output "metastore_bucket_name" {
#   description = "Name of the S3 bucket used by the metastore"
#   value       = module.metastore_s3.bucket_name
# }

# output "metastore_bucket_arn" {
#   description = "ARN of the S3 bucket used by the metastore"
#   value       = module.metastore_s3.bucket_arn
# }

# output "iam_policy_arn" {
#   description = "ARN of the IAM policy template for Unity Catalog access"
#   value       = module.metastore_s3.iam_policy_arn
# }

# output "workspace_storage_credentials" {
#   description = "Storage credentials created for each workspace"
#   value = {
#     for k, v in module.workspace_storage_credentials : k => {
#       storage_credential_id   = v.storage_credential_id
#       storage_credential_name = v.storage_credential_name
#       iam_role_arn           = v.iam_role_arn
#     }
#   }
# }

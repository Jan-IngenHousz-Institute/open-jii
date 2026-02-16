output "id" {
  description = "The ID of the cluster policy"
  value       = databricks_cluster_policy.this.id
}

output "policy_id" {
  description = "Canonical unique identifier for the cluster policy"
  value       = databricks_cluster_policy.this.policy_id
}

output "name" {
  description = "The name of the cluster policy"
  value       = databricks_cluster_policy.this.name
}

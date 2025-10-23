output "place_index_name" {
  description = "Name of the created Place Index"
  value       = aws_location_place_index.main.index_name
}

output "place_index_arn" {
  description = "ARN of the created Place Index"
  value       = aws_location_place_index.main.index_arn
}

output "place_index_create_time" {
  description = "Creation time of the Place Index"
  value       = aws_location_place_index.main.create_time
}

output "place_index_update_time" {
  description = "Last update time of the Place Index"
  value       = aws_location_place_index.main.update_time
}

output "iam_policy_arn" {
  description = "ARN of the IAM policy for Location Service access"
  value       = aws_iam_policy.location_service_policy.arn
}

output "iam_policy_name" {
  description = "Name of the IAM policy for Location Service access"
  value       = aws_iam_policy.location_service_policy.name
}
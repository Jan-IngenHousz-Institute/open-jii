output "notification_destination_id" {
  description = "The ID of the notification destination"
  value       = databricks_notification_destination.slack.id
}

output "display_name" {
  description = "The display name of the notification destination"
  value       = databricks_notification_destination.slack.display_name
}
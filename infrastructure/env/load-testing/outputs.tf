output "dlt_console_url" {
  description = "URL of the DLT web console (CloudFront distribution)"
  value       = aws_cloudformation_stack.dlt.outputs["ConsoleURL"]
}

output "dlt_api_endpoint" {
  description = "API Gateway endpoint used by the DLT console and CLI scripts"
  value       = aws_cloudformation_stack.dlt.outputs["DLTApiEndpointD98B09AC"]
}

output "dlt_scenarios_bucket" {
  description = "S3 bucket name for uploading JMeter / K6 / Locust test scripts"
  value       = aws_cloudformation_stack.dlt.outputs["ScenariosBucket"]
}

output "dlt_cognito_user_pool_id" {
  description = "Cognito User Pool ID — useful for creating additional users via CLI"
  value       = aws_cloudformation_stack.dlt.outputs["CognitoUserPoolID"]
}

output "dlt_region" {
  description = "Region the DLT main stack is deployed in"
  value       = var.aws_region
}

output "dlt_stack_name" {
  description = "CloudFormation stack name"
  value       = aws_cloudformation_stack.dlt.name
}

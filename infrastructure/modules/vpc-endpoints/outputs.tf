output "s3_endpoint_id" {
  description = "ID of the S3 VPC endpoint"
  value       = var.create_s3_endpoint ? aws_vpc_endpoint.s3[0].id : null
}

output "sts_endpoint_id" {
  description = "ID of the STS VPC endpoint"
  value       = var.create_sts_endpoint ? aws_vpc_endpoint.sts[0].id : null
}

output "kinesis_endpoint_id" {
  description = "ID of the Kinesis Streams VPC endpoint"
  value       = var.create_kinesis_endpoint ? aws_vpc_endpoint.kinesis_streams[0].id : null
}

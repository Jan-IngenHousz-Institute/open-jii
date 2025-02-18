output "s3_endpoint_id" {
  description = "ID of the S3 VPC endpoint"
  value       = aws_vpc_endpoint.s3.id
}

output "sts_endpoint_id" {
  description = "ID of the STS VPC endpoint"
  value       = aws_vpc_endpoint.sts.id
}

output "kinesis_endpoint_id" {
  description = "ID of the Kinesis Streams VPC endpoint"
  value       = aws_vpc_endpoint.kinesis_streams.id
}

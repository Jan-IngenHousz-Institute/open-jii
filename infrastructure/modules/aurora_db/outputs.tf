output "cluster_endpoint" {
  value = aws_rds_cluster.rds_cluster_aurora.endpoint
}

output "reader_endpoint" {
  value = aws_rds_cluster.rds_cluster_aurora.reader_endpoint
}

output "cluster_arn" {
  value = aws_rds_cluster.rds_cluster_aurora.arn
}

output "instance_id" {
  value = aws_rds_cluster_instance.rds_cluster_instance_aurora.id
}

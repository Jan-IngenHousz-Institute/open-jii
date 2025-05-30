data "aws_ecr_repository" "existing_repo" {
  name = "open-jii" # Use the exact name of your manually created repo
}

# data "aws_rds_cluster" "aurora" {
#  cluster_identifier = "your-aurora-cluster-id"
#}

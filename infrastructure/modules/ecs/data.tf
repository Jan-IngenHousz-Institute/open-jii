data "aws_ecr_repository" "existing_repo" {
  name = "open-jii" # Use the exact name of your manually created repo
}

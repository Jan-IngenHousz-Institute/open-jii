data "aws_ecr_repository" "existing_repo" {
  name = "my-repo" # Use the exact name of your manually created repo
}

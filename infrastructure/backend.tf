terraform {
  backend "s3" {
    bucket         = "open-jii-terraform-state"
    key            = "terraform.tfstate"
    region         = var.aws_region
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}

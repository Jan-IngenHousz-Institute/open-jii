# terraform {
#   backend "s3" {
#     bucket         = "open-jii-terraform-state-sandbox"
#     key            = "terraform.tfstate"
#     region         = "eu-central-1"
#     dynamodb_table = "terraform-state-lock"
#     encrypt        = true
#   }
# }

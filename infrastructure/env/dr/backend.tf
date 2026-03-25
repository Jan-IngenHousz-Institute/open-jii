# terraform {
#   backend "s3" {
#     bucket         = "open-jii-terraform-state-dr"
#     key            = "terraform.tfstate"
#     region         = "eu-west-1"
#     dynamodb_table = "terraform-state-lock"
#     encrypt        = true
#   }
# }

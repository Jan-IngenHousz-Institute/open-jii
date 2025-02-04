module "infrastructure" {
  source = "../../"
  
  environment = "prod"
  aws_region  = "eu-central-1"
}

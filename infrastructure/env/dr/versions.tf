terraform {
  required_version = ">= 1.5.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region # eu-west-1 (DR is the primary region here)
}

provider "aws" {
  alias  = "dr"
  region = var.aws_region
}

terraform {
  required_version = ">= 1.11.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Required by the s3 module; the state bucket replicates nothing.
provider "aws" {
  alias  = "dr"
  region = var.dr_region
}

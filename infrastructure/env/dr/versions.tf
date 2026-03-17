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

# Required to look up prod's ACM certificates — CloudFront certs must live in
# us-east-1 regardless of which region the distribution is managed from.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

provider "aws" {
  alias  = "dr"
  region = var.aws_region
}

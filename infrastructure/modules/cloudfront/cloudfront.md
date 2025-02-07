# 🌍 CloudFront Module

This module provisions an **Amazon CloudFront distribution** to serve OpenJII static content securely and efficiently using an **Amazon S3 bucket** as the origin.

## 📖 Overview

Amazon CloudFront is a **content delivery network (CDN)** that caches and delivers static and dynamic content with low latency. This module creates a CloudFront distribution configured to serve content from an S3 bucket while enforcing security and caching policies.

```mermaid
graph TD;
    subgraph "Content Delivery Network (CDN)"
        A[CloudFront Distribution] -->|Delivers Content| B[S3 Bucket (Static Files)];
        A -->|Secures Access| C[Origin Access Identity (OAI)];
        A -->|Caches Requests| D[AWS Edge Locations];
    end
    subgraph "Security & Access Control"
        E[Identity & Access Management (IAM)];
        E -.->|Manages Permissions| C;
    end
```

## 🛠 Resources Used

| Resource | Description | Documentation |
|----------|-------------|---------------|
| `aws_cloudfront_distribution` | Creates a CloudFront distribution | [AWS CloudFront Distribution](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudfront_distribution) |
| `s3_origin_config` | Configures an S3 bucket as the CloudFront origin | [AWS S3 Origin](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudfront_distribution#s3_origin_config) |
| `aws_cloudfront_origin_access_identity` | Restricts direct S3 access | [AWS CloudFront OAI](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudfront_origin_access_identity) |

## ⚙️ Usage

To deploy a CloudFront distribution using this module, use the following Terraform configuration:

```hcl
module "cloudfront" {
  source                  = "../../modules/cloudfront"
  bucket_name             = "my-static-site"
  s3_bucket_rest_endpoint = "my-static-site.s3.eu-central-1.amazonaws.com"
  oai_access_identity     = "my-oai"
  default_root_object     = "index.html"
}
```

## 🔑 Inputs

| Name                  | Description | Type   | Default | Required |
|-----------------------|-------------|--------|---------|----------|
| bucket_name           | The name of the S3 bucket used as the CloudFront origin | `string` | n/a | ✅ Yes |
| s3_bucket_rest_endpoint | The S3 bucket REST endpoint (e.g., `my-bucket.s3.eu-central-1.amazonaws.com`) | `string` | n/a | ✅ Yes |
| oai_access_identity   | The CloudFront Origin Access Identity (OAI) path | `string` | n/a | ✅ Yes |
| default_root_object   | The default root object served by CloudFront (e.g., `index.html`) | `string` | `index.html` | ❌ No |

## 📤 Outputs

| Name       | Description |
|------------|-------------|
| cloudfront_distribution_domain_name | The CloudFront distribution domain name (e.g., `d123xyz.cloudfront.net`) |

## 🌍 Notes

- This module **does not** create the S3 bucket but assumes it exists.
- CloudFront’s cache behavior can be modified for custom caching policies.
- CloudFront’s SSL certificate defaults to the **AWS-managed certificate**, but a custom SSL certificate can be applied.

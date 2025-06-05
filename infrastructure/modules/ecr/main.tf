data "aws_caller_identity" "current" {}

# Amazon Elastic Container Registry (ECR) - private Docker registry
resource "aws_ecr_repository" "this" {
  name                 = var.repository_name
  image_tag_mutability = var.image_tag_mutability # IMMUTABLE prevents tag overwriting for safety
  force_delete         = var.force_delete         # Allows deletion even with images (use carefully)

  # Vulnerability scanning - analyzes images for known security issues
  # Uses AWS-maintained CVE database, updated multiple times daily
  image_scanning_configuration {
    scan_on_push = var.enable_vulnerability_scanning
  }

  # Encryption configuration - images encrypted at rest in S3
  # KMS provides additional key management vs AES256 default encryption
  encryption_configuration {
    encryption_type = var.encryption_type
    kms_key         = var.encryption_type == "KMS" ? var.kms_key_id : null
  }

  tags = merge(
    {
      Name        = var.repository_name
      Environment = var.environment
    },
    var.tags
  )
}

# Repository access policy - implements least privilege security model
# Restricts access to specific services and enforces secure transport
resource "aws_ecr_repository_policy" "this" {
  repository = aws_ecr_repository.this.name
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid    = "AllowECSPull",
        Effect = "Allow",
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        },
        # Minimal permissions for ECS tasks to pull images
        Action = [
          "ecr:GetDownloadUrlForLayer",     # Download image layers
          "ecr:BatchGetImage",              # Get image manifests
          "ecr:BatchCheckLayerAvailability" # Check if layers exist
        ],
        Condition = {
          # Restrict to specific ECS service ARN for added security
          ArnLike = {
            "aws:SourceArn" = "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/${var.environment}/${var.service_name}"
          },
          # Enforce HTTPS/TLS for all connections
          Bool = {
            "aws:SecureTransport" = "true"
          }
        }
      },
      {
        Sid    = "AllowCICDPush",
        Effect = "Allow",
        Principal = {
          AWS = var.ci_cd_role_arn
        },
        # CI/CD pipeline permissions for building and pushing images
        Action = [
          "ecr:GetAuthorizationToken", # Get temporary credentials
          "ecr:PutImage",              # Push complete images
          "ecr:InitiateLayerUpload",   # Start layer upload
          "ecr:UploadLayerPart",       # Upload layer chunks
          "ecr:CompleteLayerUpload",   # Finalize layer upload
          "ecr:TagResource",           # Add tags to images
          "ecr:DescribeImages"         # List and describe images
        ],
        Condition = {
          Bool = {
            "aws:SecureTransport" = "true"
          }
        }
      },
      {
        Sid    = "AllowTFTesterPush",
        Effect = "Allow",
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/terraform-tester-dev"
        },
        # CI/CD pipeline permissions for building and pushing images
        Action = [
          "ecr:GetAuthorizationToken", # Get temporary credentials
          "ecr:PutImage",              # Push complete images
          "ecr:InitiateLayerUpload",   # Start layer upload
          "ecr:UploadLayerPart",       # Upload layer chunks
          "ecr:CompleteLayerUpload",   # Finalize layer upload
          "ecr:TagResource",           # Add tags to images
          "ecr:DescribeImages"         # List and describe images
        ],
        Condition = {
          Bool = {
            "aws:SecureTransport" = "true"
          }
        }
      }
    ]
  })
}

# Lifecycle policy - automated image cleanup to control storage costs
# Automatically deletes old images based on count and age rules
# Essential for preventing unbounded storage growth in CI/CD pipelines
resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last ${var.max_image_count} images"
        selection = {
          tagStatus   = "any" # Apply to all images regardless of tag status
          countType   = "imageCountMoreThan"
          countNumber = var.max_image_count
        }
        action = {
          type = "expire" # Delete images exceeding the count limit
        }
      }
    ]
  })
}

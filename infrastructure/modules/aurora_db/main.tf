resource "aws_rds_cluster" "rds_cluster_aurora" {
  cluster_identifier                  = var.cluster_identifier
  engine_mode                         = var.engine_mode
  engine                              = var.engine
  engine_version                      = var.engine_version
  database_name                       = var.database_name
  manage_master_user_password         = var.manage_master_user_password
  master_username                     = var.master_username
  iam_database_authentication_enabled = var.iam_database_authentication_enabled
  storage_encrypted                   = var.storage_encrypted
  vpc_security_group_ids              = var.vpc_security_group_ids
  db_subnet_group_name                = var.db_subnet_group_name
  preferred_backup_window             = var.preferred_backup_window
  preferred_maintenance_window        = var.preferred_maintenance_window

  serverlessv2_scaling_configuration {
    max_capacity             = var.max_capacity
    min_capacity             = var.min_capacity
    seconds_until_auto_pause = var.seconds_until_auto_pause
  }
  tags = {
    "Name" = "Aurora DB Cluster"
  }
}

resource "aws_rds_cluster_instance" "rds_cluster_instance_aurora" {
  cluster_identifier = aws_rds_cluster.rds_cluster_aurora.id
  instance_class     = var.instance_class
  engine             = aws_rds_cluster.rds_cluster_aurora.engine
  engine_version     = aws_rds_cluster.rds_cluster_aurora.engine_version

  tags = {
    "Name" = "Aurora DB Instance"
  }
}

resource "aws_iam_policy" "aurora_db_access" {
  name        = "AuroraDBAccessPolicy"
  description = "Allows developers IAM authentication access to Aurora DB"
  policy      = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["rds-db:connect"]
        Resource = "arn:aws:rds-db:${var.aws_region}:${data.aws_caller_identity.current.account_id}:dbuser:${aws_rds_cluster.rds_cluster_aurora.id}/${var.master_username}"
      },
      {
        Effect   = "Allow"
        Action   = [
          "rds:DescribeDBInstances",
          "rds:DescribeDBClusters",
          "rds:DescribeDBClusterEndpoints",
          "rds:GenerateDBAuthToken"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role" "aurora_db_dev_role" {
  name = "AuroraDBDeveloperRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/developer1",
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/developer2"
          ]
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "attach_aurora_db_policy" {
  role       = aws_iam_role.aurora_db_dev_role.name
  policy_arn = aws_iam_policy.aurora_db_access.arn
}

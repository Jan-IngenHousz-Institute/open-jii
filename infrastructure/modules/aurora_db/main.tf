# KMS key for Aurora DB encryption
resource "aws_kms_key" "aurora_key" {
  description             = "KMS key for Aurora DB encryption"
  deletion_window_in_days = var.kms_key_deletion_window
  enable_key_rotation     = var.enable_kms_key_rotation

  tags = {
    Name        = "${var.cluster_identifier}-aurora-key"
    Environment = "dev"
    Project     = "open-jii"
  }
}

resource "aws_kms_alias" "aurora_key_alias" {
  name          = "alias/${var.cluster_identifier}-aurora-key"
  target_key_id = aws_kms_key.aurora_key.key_id
}

# KMS key for Performance Insights encryption
resource "aws_kms_key" "performance_insights_key" {
  description             = "KMS key for Performance Insights encryption"
  deletion_window_in_days = var.kms_key_deletion_window
  enable_key_rotation     = var.enable_kms_key_rotation

  tags = {
    Name        = "${var.cluster_identifier}-pi-key"
    Environment = "dev"
    Project     = "open-jii"
  }
}

resource "aws_kms_alias" "performance_insights_key_alias" {
  name          = "alias/${var.cluster_identifier}-pi-key"
  target_key_id = aws_kms_key.performance_insights_key.key_id
}

# Security-hardened parameter group for Aurora PostgreSQL
resource "aws_rds_cluster_parameter_group" "aurora_security" {
  family      = "aurora-postgresql16"
  name        = "${var.cluster_identifier}-security-params"
  description = "Security-hardened parameter group for Aurora PostgreSQL"

  # Security hardening parameters
  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Log queries taking longer than 1 second
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_checkpoints"
    value = "1"
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "log_hostname"
    value = "1"
  }

  parameter {
    name  = "log_line_prefix"
    value = "%t:%r:%u@%d:[%p]:"
  }

  # Force SSL/TLS encryption for all connections
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  # Use stronger password encryption
  parameter {
    name  = "password_encryption"
    value = "scram-sha-256"
  }

  # Log temporary files for security monitoring
  parameter {
    name  = "log_temp_files"
    value = "0"
  }

  # Log lock waits for performance and security analysis
  parameter {
    name  = "log_lock_waits"
    value = "1"
  }

  # Log minimum error statements
  parameter {
    name  = "log_min_error_statement"
    value = "error"
  }

  tags = {
    Name        = "Aurora Security Parameters"
    Environment = "dev"
    Project     = "open-jii"
  }
}

resource "aws_rds_cluster" "rds_cluster_aurora" {
  # Basic cluster configuration
  cluster_identifier = var.cluster_identifier
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = "16.4"
  database_name      = var.database_name

  # Authentication and security
  master_username                     = var.master_username
  manage_master_user_password         = true
  iam_database_authentication_enabled = true
  storage_encrypted                   = true
  kms_key_id                          = aws_kms_key.aurora_key.arn

  # Network configuration
  vpc_security_group_ids          = var.vpc_security_group_ids
  db_subnet_group_name            = var.db_subnet_group_name
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.aurora_security.name

  # Backup and snapshot configuration
  backup_retention_period   = var.backup_retention_period
  preferred_backup_window   = "00:00-02:00"
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = "${var.cluster_identifier}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  copy_tags_to_snapshot     = true
  deletion_protection       = true

  # Maintenance and monitoring
  preferred_maintenance_window    = "sun:03:00-sun:07:00"
  enabled_cloudwatch_logs_exports = ["postgresql"]
  apply_immediately               = false

  # Aurora Serverless v2 scaling configuration
  serverlessv2_scaling_configuration {
    max_capacity             = var.max_capacity
    min_capacity             = var.min_capacity
    seconds_until_auto_pause = var.seconds_until_auto_pause
  }

  tags = {
    "Name"        = "Aurora DB Cluster"
    "Environment" = "dev"
    "Project"     = "open-jii"
  }
}

resource "aws_rds_cluster_instance" "rds_cluster_instance_aurora" {
  # Basic instance configuration
  cluster_identifier = aws_rds_cluster.rds_cluster_aurora.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.rds_cluster_aurora.engine
  engine_version     = aws_rds_cluster.rds_cluster_aurora.engine_version

  # Performance and monitoring
  performance_insights_enabled          = true
  performance_insights_retention_period = var.performance_insights_retention_period
  performance_insights_kms_key_id       = aws_kms_key.performance_insights_key.key_id
  monitoring_interval                   = var.enable_enhanced_monitoring ? 60 : 0
  monitoring_role_arn                   = var.enable_enhanced_monitoring ? aws_iam_role.rds_enhanced_monitoring[0].arn : null

  # Maintenance configuration
  auto_minor_version_upgrade = true
  apply_immediately          = false

  tags = {
    "Name"        = "Aurora DB Instance"
    "Environment" = "dev"
    "Project"     = "open-jii"
  }
}

# IAM role for RDS Enhanced Monitoring (conditional)
resource "aws_iam_role" "rds_enhanced_monitoring" {
  count = var.enable_enhanced_monitoring ? 1 : 0
  name  = "${var.cluster_identifier}-rds-enhanced-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    "Name"        = "RDS Enhanced Monitoring Role"
    "Environment" = "dev"
    "Project"     = "open-jii"
  }
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  count      = var.enable_enhanced_monitoring ? 1 : 0
  role       = aws_iam_role.rds_enhanced_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

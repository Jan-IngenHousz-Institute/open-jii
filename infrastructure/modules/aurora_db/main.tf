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

  # Controls which SQL statements are logged
  # 'mod' logs all DDL statements and data-modifying statements like INSERT, UPDATE, DELETE
  parameter {
    name  = "log_statement"
    value = "mod"
  }

  # Sets the minimum execution time above which statements will be logged
  # 1000ms (1 second) means only slow queries will be logged, reducing log noise
  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Log queries taking longer than 1 second
  }

  # Logs each successful connection attempt to the database
  # Helps with auditing and security monitoring
  parameter {
    name  = "log_connections"
    value = "1"
  }

  # Logs each session termination, including information about the session
  # Useful for tracking user activity and troubleshooting connection issues
  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  # Specifies libraries to preload at server start
  # pg_stat_statements enables the collection of detailed execution statistics for queries
  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }

  # Enables logging of client hostnames 
  # Important for identifying the source of database connections
  parameter {
    name  = "log_hostname"
    value = "1"
  }

  # Customizes the prefix of log lines
  # This format includes timestamp (%t), remote host (%r), user name (%u), database (%d), and process ID (%p)
  parameter {
    name         = "log_line_prefix"
    value        = "%t:%r:%u@%d:[%p]:"
    apply_method = "pending-reboot"
  }

  # Forces SSL/TLS encryption for all connections
  # Critical for data in transit protection and compliance requirements
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  # Sets password encryption algorithm
  # scram-sha-256 is more secure than the older md5 method
  parameter {
    name  = "password_encryption"
    value = "scram-sha-256"
  }

  # Controls logging of temporary files
  # Setting to '0' logs all temporary file usage, which helps detect inefficient queries
  # and potential resource issues
  parameter {
    name  = "log_temp_files"
    value = "0"
  }

  # Enables logging when a session waits longer than deadlock_timeout to acquire a lock
  # Helps identify locking issues and performance bottlenecks
  parameter {
    name  = "log_lock_waits"
    value = "1"
  }

  # Sets the minimum message severity level for which statements are logged
  # 'error' ensures that error conditions are always recorded in logs
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
  engine_version     = "16.8"
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
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.cluster_identifier}-final-snapshot"
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
  performance_insights_kms_key_id       = aws_kms_key.performance_insights_key.arn
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

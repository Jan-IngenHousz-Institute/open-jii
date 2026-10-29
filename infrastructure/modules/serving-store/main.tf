locals {
  name = "openjii-serving-store-${var.environment}"

  # Amazon Linux links the attach-time device name to the volume's NVMe device.
  data_device = "/dev/sdf"

  # The data volume outlives the instance, so its owner keeps the same IDs on every replacement.
  clickhouse_id = 400

  prometheus_port        = 9363
  prometheus_config_path = "/opt/aws/amazon-cloudwatch-agent/etc/prometheus.yaml"

  prometheus_config = yamlencode({
    global = { scrape_interval = "1m", scrape_timeout = "10s" }
    scrape_configs = [{
      job_name = "clickhouse"
      static_configs = [{
        targets = ["127.0.0.1:${local.prometheus_port}"]
        labels  = { Environment = var.environment }
      }]
    }]
  })

  # The system logs that ship without a TTL. opentelemetry_span_log defines its own engine and stays
  # empty unless tracing is on.
  system_log_tables = [
    "query_log", "trace_log", "query_thread_log", "query_views_log", "part_log", "text_log",
    "metric_log", "asynchronous_metric_log", "error_log", "query_metric_log", "crash_log",
    "backup_log", "s3queue_log",
  ]

  config_xml = templatefile("${path.module}/templates/config.xml.tftpl", {
    http_port                 = var.http_port
    prometheus_port           = local.prometheus_port
    system_log_tables         = local.system_log_tables
    system_log_retention_days = var.system_log_retention_days
  })

  # No grants means the admin, which manages access and applies the schema. The writer only inserts,
  # and keeps out of the migration ledger, which records what the schema already holds.
  users = {
    admin = { name = "openjii_admin", grants = [] }
    writer = {
      name = "openjii_writer"
      grants = [
        "GRANT SELECT, INSERT ON store.*",
        "REVOKE INSERT ON store._migrations",
      ]
    }
    reader = { name = "openjii_reader", grants = ["GRANT SELECT ON store.*"] }
  }

  # The hashes of 32 random characters, shown in plans so a replacement says what changed.
  users_xml = templatefile("${path.module}/templates/users.xml.tftpl", {
    users = [
      for role, user in local.users : {
        name            = user.name
        grants          = user.grants
        password_sha256 = nonsensitive(sha256(random_password.user[role].result))
      }
    ]
  })

  cloudwatch_agent_config_path = "/opt/aws/amazon-cloudwatch-agent/etc/openjii.json"

  cloudwatch_agent_config = jsonencode({
    agent = {
      metrics_collection_interval = 60
      omit_hostname               = true
    }
    metrics = {
      namespace = var.metrics_namespace
      metrics_collected = {
        mem = {
          measurement       = ["mem_used_percent"]
          append_dimensions = { Environment = var.environment }
        }
        disk = {
          measurement       = ["used_percent"]
          resources         = ["/var/lib/clickhouse"]
          drop_device       = true
          append_dimensions = { Environment = var.environment }
        }
      }
    }
    logs = {
      # Uptime is only published while ClickHouse answers, so its absence is the outage signal.
      metrics_collected = {
        prometheus = {
          log_group_name         = aws_cloudwatch_log_group.store.name
          prometheus_config_path = local.prometheus_config_path
          emf_processor = {
            metric_namespace = var.metrics_namespace
            metric_unit      = { ClickHouseAsyncMetrics_Uptime = "Seconds" }
            metric_declaration = [{
              source_labels    = ["job"]
              label_matcher    = "^clickhouse$"
              dimensions       = [["Environment"]]
              metric_selectors = ["^ClickHouseAsyncMetrics_Uptime$"]
            }]
          }
        }
      }
      logs_collected = {
        files = {
          collect_list = [
            for log in ["clickhouse-server.log", "clickhouse-server.err.log"] : {
              file_path       = "/var/log/clickhouse-server/${log}"
              log_group_name  = aws_cloudwatch_log_group.store.name
              log_stream_name = log
            }
          ]
        }
      }
    }
  })
}

data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

data "aws_subnet" "this" {
  id = var.subnet_id
}

resource "random_password" "user" {
  for_each = local.users

  length  = 32
  special = false
}

# One secret per role, in the shape Aurora's secrets have, so each consumer reads only its own.
module "credentials" {
  source   = "../secrets-manager"
  for_each = local.users

  name        = "${local.name}-${each.key}"
  description = "Serving store ${each.key} user"

  secret_string = jsonencode({
    username = each.value.name
    password = random_password.user[each.key].result
  })

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "store" {
  name              = "/aws/ec2/${local.name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_iam_role" "store" {
  name = local.name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.store.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# The CloudWatch agent's managed policy reaches every log group and namespace in the account; this
# reaches the store's own.
data "aws_iam_policy_document" "agent" {
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
    resources = ["${aws_cloudwatch_log_group.store.arn}:*"]
  }

  # The agent reads the instance's tags while loading its configuration, and fails without them.
  statement {
    actions   = ["ec2:DescribeTags"]
    resources = ["*"]
  }

  statement {
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = [var.metrics_namespace]
    }
  }
}

resource "aws_iam_role_policy" "agent" {
  name   = "cloudwatch-agent"
  role   = aws_iam_role.store.id
  policy = data.aws_iam_policy_document.agent.json
}

resource "aws_iam_instance_profile" "store" {
  name = local.name
  role = aws_iam_role.store.name

  tags = var.tags
}

# The data lives here, not on the instance, so the instance can be replaced at will.
resource "aws_ebs_volume" "data" {
  availability_zone = data.aws_subnet.this.availability_zone
  size              = var.data_volume_size_gb
  type              = "gp3"
  encrypted         = true
  # prevent_destroy guards only while this block is in the configuration.
  final_snapshot = true

  tags = merge(var.tags, { Name = "${local.name}-data" })

  lifecycle {
    prevent_destroy = true
  }
}

# AWS hands this address to nothing else, so a replacement instance can always take it back.
resource "aws_ec2_subnet_cidr_reservation" "store" {
  subnet_id        = var.subnet_id
  cidr_block       = "${cidrhost(data.aws_subnet.this.cidr_block, var.host_number)}/32"
  reservation_type = "explicit"
  description      = "Fixed address of ${local.name}"
}

resource "aws_instance" "store" {
  ami                  = data.aws_ssm_parameter.al2023_arm64.insecure_value
  instance_type        = var.instance_type
  subnet_id            = var.subnet_id
  private_ip           = cidrhost(data.aws_subnet.this.cidr_block, var.host_number)
  iam_instance_profile = aws_iam_instance_profile.store.name

  vpc_security_group_ids = [var.security_group_id]

  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
    tags        = merge(var.tags, { Name = "${local.name}-root" })
  }

  user_data = templatefile("${path.module}/templates/cloud-config.yaml.tftpl", {
    clickhouse_version           = var.clickhouse_version
    clickhouse_id                = local.clickhouse_id
    data_device                  = local.data_device
    config_xml                   = local.config_xml
    users_xml                    = local.users_xml
    prometheus_config_path       = local.prometheus_config_path
    prometheus_config            = local.prometheus_config
    cloudwatch_agent_config_path = local.cloudwatch_agent_config_path
    cloudwatch_agent_config      = local.cloudwatch_agent_config
  })
  user_data_replace_on_change = true

  tags = merge(var.tags, { Name = local.name })

  depends_on = [aws_ec2_subnet_cidr_reservation.store]

  # A new AMI arrives through a deliberate replacement, not on every apply.
  lifecycle {
    ignore_changes = [ami]
  }
}

# Replacing only the attachment leaves the instance stopped; replace the instance instead.
resource "aws_volume_attachment" "data" {
  device_name                    = local.data_device
  volume_id                      = aws_ebs_volume.data.id
  instance_id                    = aws_instance.store.id
  stop_instance_before_detaching = true
}

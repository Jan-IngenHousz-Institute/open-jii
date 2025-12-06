data "aws_availability_zones" "available" {}

data "aws_ec2_managed_prefix_list" "cloudfront_global" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# ----
# VPC
# ----
resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "open-jii-vpc-${var.environment}" }
}

# -----------------
# Internet Gateway
# -----------------
resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "open-jii-igw-${var.environment}" }
}

# -----------------------
# Default Security Group
# -----------------------
resource "aws_security_group" "default" {
  name        = "open-jii-default-sg-${var.environment}"
  description = "Default security group for openJII VPC"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    self      = true
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "open-jii-default-sg-${var.environment}" }
}

# -------------------------
# Aurora DB Security Group
# -------------------------
resource "aws_security_group" "aurora_sg" {
  name        = "open-jii-aurora-sg-${var.environment}"
  description = "Security group for Aurora DB"
  vpc_id      = aws_vpc.this.id


  tags = {
    "Name" = "open-jii-aurora-sg-${var.environment}"
  }
}

# -----------------------
# ALB Security Group
# -----------------------
resource "aws_security_group" "alb_sg" {
  name        = "${var.environment}-alb-sg"
  description = "Security group for Application Load Balancer (CloudFront HTTPS access only)"
  vpc_id      = aws_vpc.this.id

  # Allow HTTPS (443) from CloudFront IP ranges only
  ingress {
    description     = "Allow HTTPS from CloudFront IP ranges only"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront_global.id]
  }

  # ALB needs outbound access to forward requests to ECS tasks
  egress {
    description      = "Allow all outbound traffic"
    from_port        = 0
    to_port          = 0
    protocol         = "-1" # All protocols
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-alb-sg"
  })
}

# -----------------------
# ECS Security Group
# -----------------------
resource "aws_security_group" "ecs_sg" {
  name        = "${var.environment}-ecs-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.this.id

  # Only allow traffic from ALB on the application port
  ingress {
    description     = "Allow traffic from ALB on container port"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  # ECS tasks need outbound access for:
  # - Pulling images from ECR
  # - Sending logs to CloudWatch
  # - API calls to AWS services
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-ecs-sg"
  })
}

# --------------------------
# Migration Task Security Group
# --------------------------
resource "aws_security_group" "migration_task_sg" {
  name        = "${var.environment}-migration-task-sg"
  description = "Security group for database migration ECS tasks"
  vpc_id      = aws_vpc.this.id

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    "Name"        = "${var.environment}-migration-task-sg"
    "Environment" = var.environment
  }
}

# Allow migration tasks to access Aurora database
resource "aws_security_group_rule" "aurora_migration_ingress" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.migration_task_sg.id
  security_group_id        = aws_security_group.aurora_sg.id
  description              = "Allow access from migration ECS tasks"
}

# -------------------------
# Server Lambda Aurora Access Security Group
# -------------------------
resource "aws_security_group" "server_lambda_aurora" {
  name        = "${var.environment}-opennext-server-sg"
  description = "Security group allowing OpenNext server Lambda to access Aurora database"
  vpc_id      = aws_vpc.this.id

  # Allow all outbound traffic (required for Lambda to access AWS services and database)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    "Name"        = "${var.environment}-opennext-server-sg"
    "Environment" = var.environment
  }
}

# ----------------------
# Security group rule to allow ECS tasks to access Aurora database
# ----------------------
resource "aws_security_group_rule" "ecs_to_aurora" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_sg.id
  security_group_id        = aws_security_group.aurora_sg.id
  description              = "Allow access from backend ECS tasks to Aurora database"
}

# Security group rule to allow server Lambda to access Aurora database
resource "aws_security_group_rule" "server_lambda_to_aurora" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.server_lambda_aurora.id
  security_group_id        = aws_security_group.aurora_sg.id
  description              = "Allow access from OpenNext server Lambda to Aurora database"
}

# ---------------
# Public Subnets
# ---------------
resource "aws_subnet" "public" {
  count                   = var.az_count
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.cidr_block, var.subnet_bits, count.index)
  availability_zone       = element(data.aws_availability_zones.available.names, count.index)
  map_public_ip_on_launch = true
  tags                    = { Name = "open-jii-public-subnet-${count.index}-${var.environment}" }
}

# ----------------
# Private Subnets 
# ----------------
resource "aws_subnet" "private" {
  count             = var.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, var.subnet_bits, count.index + 100)
  availability_zone = element(data.aws_availability_zones.available.names, count.index)
  tags              = { Name = "open-jii-private-subnet-${count.index}-${var.environment}" }
}

# ----------------------
# Aurora DB Subnet Group
# ----------------------
resource "aws_db_subnet_group" "aurora_subnet_group" {
  name       = "${var.environment}-aurora-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    "Name"        = "${var.environment} Aurora DB Subnet Group"
    "Environment" = var.environment
  }
}

# -----------------
# Isolated Subnets
# -----------------
resource "aws_subnet" "isolated" {
  count             = var.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, var.subnet_bits, count.index + 200)
  availability_zone = element(data.aws_availability_zones.available.names, count.index)
  tags              = { Name = "open-jii-isolated-subnet-${count.index}-${var.environment}" }
}

# -------------------
# Public Route Table 
# -------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "open-jii-public-rt-${var.environment}" }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public_assoc" {
  count          = var.az_count
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# -------------
# NAT Gateways 
# -------------
resource "aws_eip" "nat" {
  count  = var.az_count
  domain = "vpc"
}

resource "aws_nat_gateway" "nat" {
  count         = var.az_count
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  tags          = { Name = "open-jii-nat-${count.index}-${var.environment}" }
}

# ---------------------
# Private Route Tables
# ---------------------
resource "aws_route_table" "private" {
  count  = var.az_count
  vpc_id = aws_vpc.this.id
  tags   = { Name = "open-jii-private-rt-${count.index}-${var.environment}" }
}

resource "aws_route" "private_nat" {
  count                  = var.az_count
  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.nat[count.index].id
}

resource "aws_route_table_association" "private_assoc" {
  count          = var.az_count
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ---------------------
# Isolated Route Table
# ---------------------
resource "aws_route_table" "isolated" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "open-jii-isolated-rt-${var.environment}" }
}

resource "aws_route_table_association" "isolated_assoc" {
  count          = var.az_count
  subnet_id      = aws_subnet.isolated[count.index].id
  route_table_id = aws_route_table.isolated.id
}

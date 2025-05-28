data "aws_availability_zones" "available" {}

# ----
# VPC
# ----
resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "open-jii-vpc-dev" }
}

# -----------------
# Internet Gateway
# -----------------
resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "open-jii-igw-dev" }
}

# -----------------------
# Default Security Group
# -----------------------
resource "aws_security_group" "default" {
  name        = "open-jii-default-sg-dev"
  description = "Default security group for OpenJII VPC"
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
  tags = { Name = "open-jii-default-sg-dev" }
}

# -----------------------
# ALB Security Group
# -----------------------

resource "aws_security_group" "alb_sg" {
  name   = "${var.vpc_name}-alb-sg"
  vpc_id = aws_vpc.this.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Allow public traffic
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Allow HTTPS traffic
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]  # Allow outbound traffic
  }
}

# -----------------------
# ECS Security Group
# -----------------------

resource "aws_security_group" "ecs_sg" {
  name   = "ecs-sg"
  vpc_id = "vpc-12345678"  # Replace with your actual VPC ID

  ingress {
    from_port   = 3020  # Correct container port
    to_port     = 3020
    protocol    = "tcp"
    security_groups = ["sg-87654321"]  # Replace with your ALB security group ID
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
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
  tags                    = { Name = "open-jii-public-subnet-${count.index}-dev" }
}

# ----------------
# Private Subnets 
# ----------------
resource "aws_subnet" "private" {
  count             = var.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, var.subnet_bits, count.index + 100)
  availability_zone = element(data.aws_availability_zones.available.names, count.index)
  tags              = { Name = "open-jii-private-subnet-${count.index}-dev" }
}

# -----------------
# Isolated Subnets
# -----------------
resource "aws_subnet" "isolated" {
  count             = var.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, var.subnet_bits, count.index + 200)
  availability_zone = element(data.aws_availability_zones.available.names, count.index)
  tags              = { Name = "open-jii-isolated-subnet-${count.index}-dev" }
}

# -------------------
# Public Route Table 
# -------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "open-jii-public-rt-dev" }
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
  tags          = { Name = "open-jii-nat-${count.index}-dev" }
}

# ---------------------
# Private Route Tables
# ---------------------
resource "aws_route_table" "private" {
  count  = var.az_count
  vpc_id = aws_vpc.this.id
  tags   = { Name = "open-jii-private-rt-${count.index}-dev" }
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
  tags   = { Name = "open-jii-isolated-rt-dev" }
}

resource "aws_route_table_association" "isolated_assoc" {
  count          = var.az_count
  subnet_id      = aws_subnet.isolated[count.index].id
  route_table_id = aws_route_table.isolated.id
}

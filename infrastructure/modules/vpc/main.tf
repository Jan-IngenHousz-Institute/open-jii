data "aws_availability_zones" "available" {}

locals {
  # If nat_count is explicitly provided, use it; otherwise use environment-based logic
  effective_nat_count = var.nat_count != null ? var.nat_count : (var.environment == "dev" ? 1 : var.az_count)
}

# ----
# VPC
# ----
resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true # Required for Route53 private zones and service discovery
  enable_dns_hostnames = true # Enables public DNS hostnames for instances with public IPs
  tags                 = { Name = "open-jii-vpc-${var.environment}" }
}

# -----------------
# Internet Gateway
#
# Provides internet access to public subnets
#  - Required for ALB to receive traffic from the internet
#  - Only one IGW can be attached per VPC
# -----------------
resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "open-jii-igw-${var.environment}" }
}

# -----------------------
# Default Security Group
#
# Baseline security for VPC resources
#  - Allows internal communication between resources in the VPC
#  - Blocks all external traffic by default (defense in depth)
# -----------------------
resource "aws_security_group" "default" {
  name        = "open-jii-default-sg-${var.environment}"
  description = "Default security group for OpenJII VPC"
  vpc_id      = aws_vpc.this.id

  # Allow all internal VPC communication
  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    self      = true # References this security group itself
  }

  # Allow all outbound traffic (can be restricted further if needed)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "open-jii-default-sg-${var.environment}" }
}

# -----------------------
# ALB Security Group
#
# Application Load Balancer Security Group
# - Controls internet access to the ALB , first line of defense
# - Allows standard HTTP/HTTPS traffic from anywhere on the internet

# -----------------------

resource "aws_security_group" "alb_sg" {
  name        = "${var.environment}-alb-sg"
  description = "Security group for ALB"
  vpc_id      = aws_vpc.this.id

  # HTTP access - typically redirects to HTTPS for security
  ingress {
    description      = "Allow HTTP from anywhere"
    from_port        = 80
    to_port          = 80
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"] # All IPv4 addresses
    ipv6_cidr_blocks = ["::/0"]      # All IPv6 addresses
  }

  # HTTPS access - encrypted traffic
  ingress {
    description      = "Allow HTTPS from anywhere"
    from_port        = 443
    to_port          = 443
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  # ALB needs outbound access to forward requests to ECS tasks
  egress {
    description      = "Allow all outbound traffic" # More restrictive rules can be applied if needed
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
#
# Restricts access to ECS containers - only allows traffic from ALB
# Implements defense in depth by limiting container exposure
# -----------------------

resource "aws_security_group" "ecs_sg" {
  name        = "${var.environment}-ecs-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.this.id

  # Only allow traffic from ALB on the application port
  # Source traffic is restricted to ALB security group (not IP ranges)
  ingress {
    description     = "Allow traffic from ALB on container port"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id] # Only allows traffic from the ALB's security group
  }

  # ECS tasks need outbound access for:
  # - Pulling images from ECR
  # - Sending logs to CloudWatch
  # - API calls to AWS services
  # - External API calls (if required by application)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ---------------
# Public Subnets
#
# - Hosts ALB and NAT Gateways
# - Resources here can receive traffic directly from the internet
# - Used for internet-facing load balancers and NAT Gateways
# ---------------
resource "aws_subnet" "public" {
  count                   = var.az_count
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.cidr_block, var.subnet_bits, count.index)
  availability_zone       = element(data.aws_availability_zones.available.names, count.index)
  map_public_ip_on_launch = true # Instances get public IPs automatically
  tags                    = { Name = "open-jii-public-subnet-${count.index}-${var.environment}" }
}

# ----------------
# Private Subnets 
#
# - Hosts ALB and NAT Gateways
# - Resources here can receive traffic directly from the internet
# - Used for internet-facing load balancers and NAT Gateways
# ----------------
resource "aws_subnet" "private" {
  count             = var.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, var.subnet_bits, count.index + 100)
  availability_zone = element(data.aws_availability_zones.available.names, count.index)
  tags              = { Name = "open-jii-private-subnet-${count.index}-${var.environment}" }
}

# -----------------
# Isolated Subnets
#
# - For databases and highly sensitive resources
# - No internet access at all - maximum security isolation
# - Used for RDS, ElastiCache, or other data stores
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
#

# - Routes traffic to Internet Gateway
# - All public subnets share this route table for internet access
# - Simple routing: local VPC traffic stays internal, everything else goes to IGW
# -------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "open-jii-public-rt-${var.environment}" }
}

# Default route for internet traffic from public subnets
resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

# Associate public subnets with the public route table
resource "aws_route_table_association" "public_assoc" {
  count          = var.az_count
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# -------------
# NAT Gateways 

# - Managed NAT service + EIP
# - Automatically scales, no maintenance required vs NAT instances
# -------------
resource "aws_eip" "nat" {
  count  = local.effective_nat_count
  domain = "vpc" # VPC scope for modern AWS accounts

  tags = {
    Name = "open-jii-nat-eip-${count.index}-${var.environment}"
  }
}
resource "aws_nat_gateway" "nat" {
  count         = local.effective_nat_count
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  tags          = { Name = "open-jii-nat-${count.index}-${var.environment}" }

  # Ensure Internet Gateway is created before NAT Gateway
  depends_on = [aws_internet_gateway.this]
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
  # If we have fewer NAT gateways than AZs, route to the NAT in the same AZ or to the first NAT
  nat_gateway_id = count.index < local.effective_nat_count ? aws_nat_gateway.nat[count.index].id : aws_nat_gateway.nat[0].id
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

variable "public_subnet_ids" {
  description = "List of public subnets for the ALB"
  type        = list(string)
}

variable "container_port" {
  description = "Port exposed by the container"
  type        = number
}

variable "service_name" {
  description = "Base name for the service"
  type        = string
}

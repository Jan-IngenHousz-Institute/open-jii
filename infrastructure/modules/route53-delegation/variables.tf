variable "parent_zone_id" {
  description = "The ID of the parent Route 53 hosted zone where the delegation record will be created."
  type        = string
}

variable "subdomain" {
  description = "The subdomain to delegate (e.g., 'dev.example.com')."
  type        = string
}

variable "name_servers" {
  description = "A list of name servers for the subdomain's hosted zone."
  type        = list(string)
  sensitive = true
}

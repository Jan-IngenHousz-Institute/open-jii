# Create NS delegation record in parent zone
resource "aws_route53_record" "delegation" {
  zone_id = var.parent_zone_id
  name    = var.subdomain
  type    = "NS"
  ttl     = var.ttl
  records = var.name_servers
}

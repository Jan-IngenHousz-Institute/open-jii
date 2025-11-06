output "delegation_record_fqdn" {
  description = "The FQDN of the created NS delegation record."
  value       = aws_route53_record.delegation.fqdn
}

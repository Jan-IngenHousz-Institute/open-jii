# Child zone of the standalone openjii-equipment app, in its own account
# (243111812735). The record was created by hand on 2026-10-30; adopt it.
module "instrument_tracking_subdomain_delegation" {
  source         = "../../modules/route53-delegation"
  parent_zone_id = module.route53.route53_zone_id
  subdomain      = "equipment.${var.domain_name}"
  ttl            = 3600
  name_servers = [
    "ns-918.awsdns-50.net",
    "ns-1927.awsdns-48.co.uk",
    "ns-421.awsdns-52.com",
    "ns-1141.awsdns-14.org",
  ]
}

import {
  to = module.instrument_tracking_subdomain_delegation.aws_route53_record.delegation
  id = "${module.route53.route53_zone_id}_equipment.${var.domain_name}_NS"
}

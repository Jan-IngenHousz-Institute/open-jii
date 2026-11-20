# lab.openjii.org is served from openJII Lab's own AWS account
# (243111812735). The NS record was created by hand on 2026-11-13 and adopted on
# 2026-11-20.
module "lab_subdomain_delegation" {
  source         = "../../modules/route53-delegation"
  parent_zone_id = module.route53.route53_zone_id
  subdomain      = "lab.${var.domain_name}"
  ttl            = 3600
  name_servers = [
    "ns-1325.awsdns-37.org",
    "ns-402.awsdns-50.com",
    "ns-1802.awsdns-33.co.uk",
    "ns-628.awsdns-14.net",
  ]
}

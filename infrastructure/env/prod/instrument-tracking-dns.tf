# Child-zone nameservers from the standalone app's successful DNS workflow 40927946148.
module "instrument_tracking_subdomain_delegation" {
  source         = "../../modules/route53-delegation"
  parent_zone_id = module.route53.route53_zone_id
  subdomain      = "assets.${var.domain_name}"
  name_servers = [
    "ns-1504.awsdns-60.org",
    "ns-2005.awsdns-58.co.uk",
    "ns-403.awsdns-50.com",
    "ns-651.awsdns-17.net",
  ]
}

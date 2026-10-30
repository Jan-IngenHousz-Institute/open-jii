# Child-zone nameservers of the standalone openjii-equipment app.
module "instrument_tracking_subdomain_delegation" {
  source         = "../../modules/route53-delegation"
  parent_zone_id = module.route53.route53_zone_id
  subdomain      = "equipment.${var.domain_name}"
  name_servers = [
    "ns-1444.awsdns-52.org",
    "ns-1580.awsdns-05.co.uk",
    "ns-378.awsdns-47.com",
    "ns-821.awsdns-38.net",
  ]
}

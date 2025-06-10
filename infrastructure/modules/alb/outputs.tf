output "alb_arn" {
  value = aws_lb.app_alb.arn
}

output "target_group_arn" {
  value = aws_lb_target_group.app_tg.arn
}

output "alb_dns_name" {
  value = aws_lb.app_alb.dns_name
}

output "alb_zone_id" {
  description = "The zone ID of the ALB"
  value       = aws_lb.app_alb.zone_id
}

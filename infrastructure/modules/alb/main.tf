resource "aws_lb" "app_alb" {
  name               = "${var.service_name}-alb"
  internal           = false  # Set to true if ALB should only be private
  load_balancer_type = "application"
  security_groups    = var.security_groups 
  subnets            = var.public_subnet_ids
}


resource "aws_lb_target_group" "app_tg" {
  name        = "${var.service_name}-tg"
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id
}

resource "aws_lb_listener" "app_listener" {
  load_balancer_arn = aws_lb.app_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg.arn
  }
}

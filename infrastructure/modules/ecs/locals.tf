locals {
  healthcheck_cmd = [
    "CMD-SHELL",
    "wget --no-verbose --tries=1 --spider http://localhost:${var.container_port}/health || exit 1"
  ]
}

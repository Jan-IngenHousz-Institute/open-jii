# Secrets whose values OpenTofu no longer holds (OJD-2122). The secrets stay; each value is set with
# `pnpm secrets:set`, so it reaches no plan and no state. These blocks only drop the old versions
# from state. Without `destroy = false`, removing them would delete the live values.

removed {
  from = module.auth_secrets.aws_secretsmanager_secret_version.secret_version
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.contentful_secrets.aws_secretsmanager_secret_version.secret_version
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.mailchimp_secrets.aws_secretsmanager_secret_version.secret_version
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.status_contentful_secrets.aws_secretsmanager_secret_version.secret_version
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.status_slack_secrets.aws_secretsmanager_secret_version.secret_version
  lifecycle {
    destroy = false
  }
}

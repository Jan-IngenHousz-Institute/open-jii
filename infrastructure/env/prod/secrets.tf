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

# OJD-2122's second part. The Databricks secrets are forgotten whole, the values OpenTofu still
# writes included: `databricks_secret.value` writes those again, and a write to an existing key
# replaces its value with the same one.

removed {
  from = module.databricks_secrets.aws_secretsmanager_secret_version.secret_version
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.ses_secrets.aws_secretsmanager_secret_version.secret_version
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.ses.aws_iam_access_key.ses_smtp
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.node_service_principal.databricks_service_principal_secret.this
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.event_hooks_secret_scope.databricks_secret.secret
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.experiment_secret_scope.databricks_secret.secret
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.serving_store_secret_scope.databricks_secret.secret
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.serving_store.random_password.user
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.serving_store.module.credentials.aws_secretsmanager_secret_version.secret_version
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.play_review_sign_in.random_password.email_local_part
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.play_review_sign_in.random_password.otp
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.play_review_sign_in.module.secret.aws_secretsmanager_secret_version.secret_version
  lifecycle {
    destroy = false
  }
}

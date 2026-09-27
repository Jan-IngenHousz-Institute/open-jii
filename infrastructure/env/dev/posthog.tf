# PostHog as code. openJII has one PostHog project (80726) for every environment, because the
# organisation is on PostHog's free plan, which allows a single project; events carry an
# `environment` property to tell environments apart. The project belongs to neither environment, so
# it is applied from this root, which applies on every merge to main: a flag change goes live when
# its pull request merges, not with the next prod promotion. Prod's root does not touch PostHog.
#
# On a paid plan each root would own a project of its own (`posthog_project`), and this moves out.
module "posthog" {
  source = "../../modules/posthog"

  # Issue events carry no environment, so every error alert, prod's included, posts here.
  slack_webhook_url = var.slack_webhook_url

  # Off for the first apply, which is the deploy that starts reporting server and phone errors: their
  # first burst of new issues is triaged once instead of posting one by one. Turn on after.
  error_alerts_enabled = false
}

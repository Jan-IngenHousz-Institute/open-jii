# rotate-a-secret

**Replaces a credential the platform uses with a new value, without an outage.** Values never change
on their own, so this runs only on purpose: on the rotation date the credential register gives it, when
someone who could read it leaves, or when it may have leaked.

## Before you start

- You need write access to Secrets Manager in the environment's AWS account, through your SSO role.
  CloudTrail records each change under your name. Nobody else needs access to the account: services
  pick up the new value through a deploy, below.
- Open a ticket for the rotation and note in it what you rotated, when, and the run that redeployed.
  That record is the evidence the credential register asks for.
- Rotate dev first and check it before prod.

## The order that avoids an outage

1. **Make the new value** at its source, from the table below, and keep the old one working when the
   source allows two at once.
2. **Store it**: `pbpaste | pnpm secrets:set <env> <secret> --key <KEY> --aws-profile <profile>`. The
   command prints which keys of that secret still have no value. In the AWS console, edit the secret's
   JSON and change only that key.
3. **Restart what reads it**, from the table: a service reads a secret when it starts, not after.
   - dev: dispatch the app's deploy workflow (`deploy-backend.yml`, `deploy-nextjs-opennext.yml`) on
     `main`.
   - prod: start the PROD Release Workflow from the current `release/*` branch with the app in
     `deploy_app` and `deploy_infrastructure` off. It passes the `prod-approval` gate like any release.
4. **Check** the app works with the new value.
5. **Revoke the old value** at its source.

## Secrets and what reads them

| `secrets:set` secret | Key                                                            | Made at                              | Read by               | Restart after setting                                                    | Two values at once                                                                |
| -------------------- | -------------------------------------------------------------- | ------------------------------------ | --------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `auth`               | `AUTH_SECRET`                                                  | `openssl rand -base64 48`            | backend               | backend                                                                  | no: every user is signed out, so pick a quiet time                                |
| `auth`               | `NOTIFICATION_UNSUBSCRIBE_SECRET`                              | `openssl rand -base64 48`            | backend               | backend                                                                  | no: unsubscribe links in emails sent before the rotation stop working             |
| `auth`               | `AUTH_GITHUB_SECRET`                                           | the GitHub OAuth app, Client secrets | backend               | backend                                                                  | yes: GitHub keeps both until you delete the old one                               |
| `auth`               | `AUTH_ORCID_SECRET`                                            | the ORCID developer tools            | backend               | backend                                                                  | no: sign-in with ORCID fails until the backend restarts, so restart straight away |
| `contentful`         | `CONTENTFUL_ACCESS_TOKEN`                                      | Contentful, Settings, API keys       | backend, web          | backend and web                                                          | yes: create a new key and delete the old one after                                |
| `contentful`         | `CONTENTFUL_PREVIEW_ACCESS_TOKEN`, `CONTENTFUL_PREVIEW_SECRET` | Contentful, the same API key         | web                   | web                                                                      | yes                                                                               |
| `mailchimp`          | `MAILCHIMP_API_KEY`                                            | Mailchimp, Account, API keys         | backend               | backend                                                                  | yes                                                                               |
| `status-contentful`  | `CONTENTFUL_ACCESS_TOKEN`                                      | Contentful, a separate delivery key  | status publisher      | none: see below                                                          | yes                                                                               |
| `status-slack`       | none, the value is the webhook address                         | Slack, the app's Incoming Webhooks   | status Slack function | none: it reads the secret again after 15 minutes and after a failed post | yes                                                                               |

The ids in these secrets, such as `AUTH_GITHUB_ID`, `CONTENTFUL_SPACE_ID` and the Mailchimp audience,
change only when the account behind them changes, not on rotation.

**The web build** also reads `CONTENTFUL_ACCESS_TOKEN` from the GitHub secret of the same name in each
environment. Set it there too before redeploying web, or the build uses the old key.

**The status publisher** keeps its Contentful key until a read fails, then reads the secret again on
its next run. So set the new key and revoke the old one: one run fails, keeps publishing the incidents
it read last, and the run after uses the new key.

## Not covered yet

The Databricks webhook credentials, the Slack webhook used by Grafana, PostHog and Databricks, the
PostHog key Grafana uses, and the credentials OpenTofu generates still pass through OpenTofu. Changing
one of those is an infrastructure change until OJD-2122's second part moves them out; this page gains
their rows then.

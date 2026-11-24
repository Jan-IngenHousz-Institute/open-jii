# rotate-a-secret

**Replaces a credential the platform uses with a new value, without an outage.** Values never change
on their own, so this runs only on purpose: on the rotation date the credential register gives it, when
someone who could read it leaves, or when it may have leaked.

## Before you start

- You need `secretsmanager:GetSecretValue` and `PutSecretValue` in the environment's AWS account,
  through your SSO role: setting one key of a JSON secret reads the secret before writing it.
  CloudTrail records each change under your name. Nobody else needs access to the account: services
  pick up the new value through a deploy, below.
- One person rotates a secret at a time. Two people setting different keys of one secret at once can
  both see success while the second write drops the first one's value.
- Open a ticket for the rotation and note in it what you rotated, when, and the run that redeployed.
  That record is the evidence the credential register asks for.
- Rotate dev first and check it before prod.

## The order that avoids an outage

1. **Make the new value** at its source, from the table below, and keep the old one working when the
   source allows two at once.
2. **Store it**: `pbpaste | pnpm secrets:set <env> <secret> --key <KEY> --aws-profile <profile>`, or
   `pbpaste | pnpm secrets:set <env> status-slack --aws-profile <profile>` for the status channel's
   webhook, which is a single value with no key. The command prints which keys of that secret still have
   no value. In the AWS console, edit the secret's JSON and change only that key.
3. **Restart what reads it**, from the table: a service reads a secret when it starts, not after.
   - dev: dispatch the app's deploy workflow (`deploy-backend.yml`, `deploy-nextjs-opennext.yml`) on
     `main`.
   - prod: start the PROD Release Workflow from the current `release/*` branch with the app in
     `deploy_app` and `deploy_infrastructure` off. It passes the `prod-approval` gate like any release.
4. **Check** the restarted app works with the new value: it now reads nothing else, so this is the
   proof that the new value is right. For Contentful, see below: a page that renders proves little,
   because cached content keeps it rendering after a bad token.
5. **Revoke the old value** at its source.

## Secrets and what reads them

| `secrets:set` secret | Key                                    | Made at                                 | Read by               | Restart after setting                                                    | Two values at once                                                                |
| -------------------- | -------------------------------------- | --------------------------------------- | --------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `auth`               | `AUTH_SECRET`                          | `openssl rand -base64 48`               | backend               | backend                                                                  | no: every user is signed out, so pick a quiet time                                |
| `auth`               | `NOTIFICATION_UNSUBSCRIBE_SECRET`      | `openssl rand -base64 48`               | backend               | backend                                                                  | no: unsubscribe links in emails sent before the rotation stop working             |
| `auth`               | `AUTH_GITHUB_SECRET`                   | the GitHub OAuth app, Client secrets    | backend               | backend                                                                  | yes: GitHub keeps both until you delete the old one                               |
| `auth`               | `AUTH_ORCID_SECRET`                    | the ORCID developer tools               | backend               | backend                                                                  | no: sign-in with ORCID fails until the backend restarts, so restart straight away |
| `contentful`         | `CONTENTFUL_ACCESS_TOKEN`              | Contentful, Settings, API keys          | backend, web          | backend and web                                                          | yes: a new API key, with the old one deleted last; see below                      |
| `contentful`         | `CONTENTFUL_PREVIEW_ACCESS_TOKEN`      | the same new API key, its preview token | web                   | web                                                                      | yes, rotated with the delivery token: see below                                   |
| `contentful`         | `CONTENTFUL_PREVIEW_SECRET`            | `openssl rand -hex 32`                  | web                   | web, then the preview URLs: see below                                    | no: previews answer 401 until the preview URLs carry the new value                |
| `mailchimp`          | `MAILCHIMP_API_KEY`                    | Mailchimp, Account, API keys            | backend               | backend                                                                  | yes                                                                               |
| `status-contentful`  | `CONTENTFUL_ACCESS_TOKEN`              | the same key as `contentful`            | status publisher      | none: see below                                                          | yes                                                                               |
| `status-slack`       | none, the value is the webhook address | Slack, the app's Incoming Webhooks      | status Slack function | none: it reads the secret again after 15 minutes and after a failed post | yes                                                                               |
| `databricks`         | `DATABRICKS_CLIENT_SECRET`             | the node service principal: see below   | backend               | backend                                                                  | yes: a principal holds several secrets, so delete the old one last                |
| `databricks`         | the three `DATABRICKS_WEBHOOK_*` keys  | `openssl rand -hex 32`: see below       | backend, pipelines    | backend                                                                  | no: the pipelines' calls fail until both sides hold the new values                |
| `ses`                | both `*_EMAIL_SERVER` keys             | `pnpm secrets:ses-smtp`: see below      | backend               | backend                                                                  | yes: the SMTP user holds two keys, so delete the old one last                     |
| `play-review`        | `AUTH_PLAY_REVIEW_OTP`                 | six random digits                       | backend               | backend                                                                  | no: see `infrastructure/modules/play-review-sign-in/README.md`                    |
| `serving-store-*`    | `password`                             | `openssl rand -hex 32`: see below       | each role's user      | the role's consumer: see below                                           | no: ClickHouse holds one password per user                                        |

The ids in these secrets, such as `AUTH_GITHUB_ID`, `CONTENTFUL_SPACE_ID` and the Mailchimp audience,
change only when the account behind them changes, not on rotation.

**The web build** also reads `CONTENTFUL_ACCESS_TOKEN` from the GitHub secret of the same name in each
environment. Set it there too before redeploying web, or the build uses the old key.

**The Contentful API key** carries two tokens, delivery and preview, and deleting the key revokes both.
So rotate them together from one new API key. Store its delivery token in all three places that hold
it: `contentful` `CONTENTFUL_ACCESS_TOKEN`, `status-contentful` `CONTENTFUL_ACCESS_TOKEN`, and the
`CONTENTFUL_ACCESS_TOKEN` GitHub secret the web build reads. Store its preview token as `contentful`
`CONTENTFUL_PREVIEW_ACCESS_TOKEN`. Redeploy backend and web, then check the new tokens:

- Read Contentful with each stored delivery token, since a page that renders proves nothing: pages
  are built ahead with the build's token and published content is cached for an hour. Run this for
  `openjii-contentful-secrets-<env>` and again for `openjii-status-contentful-<env>`. It prints
  `200` when the token reads published content and `401` when it does not, and never the token.

  ```sh
  SECRET=$(aws secretsmanager get-secret-value --profile openjii-<env> --region eu-central-1 \
    --secret-id openjii-contentful-secrets-<env> --query SecretString --output text)
  curl -s -o /dev/null -w '%{http_code}\n' \
    -H "Authorization: Bearer $(jq -r .CONTENTFUL_ACCESS_TOKEN <<<"$SECRET")" \
    "https://cdn.contentful.com/spaces/$(jq -r .CONTENTFUL_SPACE_ID <<<"$SECRET")/environments/master/entries?limit=1"
  unset SECRET
  ```

- Open an editor's draft preview, which reads with the preview token and is never cached.

**Before deleting the old API key**, find everything else that uses it. Dev and prod read the same
Contentful space, and the mobile app builds a delivery token into every release
(`EXPO_PUBLIC_CONTENTFUL_ACCESS_TOKEN`), which installed versions keep using for alerts and the
force-update check. Contentful, Settings, API keys lists each key by name. If prod still uses the old
key, rotate it to the new key first. An installed app keeps the token its release was built with,
so if a mobile release carries the old key, give mobile a key of its own in the next release and
keep the old key until no supported version carries it. Only then delete the old key. Otherwise the
status publisher, the next web build, the previews or installed apps keep using a revoked token.

**The status publisher** keeps its Contentful key until a read fails. After a failure it waits five
minutes before reading Contentful again, and that read takes the secret afresh. Until then it keeps
publishing the incidents it read last, so the status page looks fine either way. About ten minutes
after deleting the old key, check that its last successful read moved past that time:
`aws s3 cp s3://open-jii-status-state-<env>/status-feed.json - | jq -r .content.fetchedAt`. A time
before the deletion means it cannot read with the new token; the log group
`/aws/lambda/<env>-status-publisher` says why.

**The preview secret** is not an API key. It is the `x-contentful-preview-secret` value in the preview
URLs of Contentful's content model, which the web app checks (`apps/web/app/api/enable-draft/route.ts`).
Store the new value, redeploy web, then change the preview URLs in Contentful, Settings, Content
preview, straight away: between the redeploy and that change, editors' previews answer 401.

**The Databricks client secret** belongs to the node service principal, whose application id is the
backend's `DATABRICKS_CLIENT_ID`. Create the new one with the account-level Databricks CLI profile
and pipe it straight in, so it never shows: `databricks account service-principal-secrets create
<principal id> -p <account profile> | jq -r .secret | pnpm secrets:set <env> databricks --key
DATABRICKS_CLIENT_SECRET`. Redeploy the backend, check that an experiment's data page loads, then
delete the old secret with `databricks account service-principal-secrets delete`.

**The webhook key** is three values the backend checks and two the pipelines sign with. Make each
with `openssl rand -hex 32`, the key id included, and keep them in shell variables rather than on
screen. Store the id and the secret twice, in `databricks` (`DATABRICKS_WEBHOOK_API_KEY_ID`,
`DATABRICKS_WEBHOOK_SECRET`) and in `webhook-scope` (`webhook_api_key_id`, `webhook_secret`), and
the key as `databricks` `DATABRICKS_WEBHOOK_API_KEY`. For example
`printf %s "$WEBHOOK_SECRET" | pnpm secrets:set <env> webhook-scope --key webhook_secret`. Then
redeploy the backend straight away: the pipelines read the scope on each call, so their calls fail
from the scope write until the backend restarts.

**The SES SMTP key** is an access key of the IAM user `<env>-ses-smtp-user`, which may hold two at
once. `aws iam create-access-key --user-name <env>-ses-smtp-user | pnpm secrets:ses-smtp <env>`
stores the SMTP address built from the new one and prints its id. Redeploy the backend, check that a
sign-in code arrives, then delete the older key: `aws iam list-access-keys` names both.

**The serving store's passwords** are one secret per role, `openjii-serving-store-<env>-<role>`, each
holding `username` and `password`. The store's instance hashes them into ClickHouse's users at boot,
and again whenever its script runs. ClickHouse holds one password per user, so a consumer fails from
the moment the store takes the new password until it restarts with it. For one role:

1. `openssl rand -hex 32 | tr -d '\n' | pnpm secrets:set <env> serving-store-<role> --key password`
   stores the password, writes it to the `serving-store-<env>` scope too for `writer` and
   `reloader`, and has the store take it through SSM Run Command, so nobody needs a shell on the
   instance. ClickHouse rereads its users without a restart. If any step fails, nothing has taken
   the new password yet, so run the command again with a new one.
2. Restart the role's consumer straight away; the command names it. `reader`: redeploy the backend.
   `writer`: restart the pipelines' feed, which reads the scope when it starts. `reloader`: nothing,
   the next reload reads it. `admin`: nothing, the migration runner reads it on its next run.

A new instance reads the passwords at boot, so replacing the instance needs no step here.

## Values that stay in OpenTofu

Three kinds of value still pass through OpenTofu, because the resource that uses them holds them: a
refresh reads them back into the state even when the configuration leaves them out.

- **Slack webhooks.** The Grafana contact point, PostHog's error alert and the Databricks job
  notifications and event hooks each post with a webhook OpenTofu holds. Each takes its own, from
  the GitHub secrets `SLACK_WEBHOOK_URL_GRAFANA`, `SLACK_WEBHOOK_URL_POSTHOG` and
  `SLACK_WEBHOOK_URL_DATABRICKS`, falling back to `SLACK_WEBHOOK_URL` while one is unset. A leaked
  webhook can only post into its own channel. To rotate one, add a webhook to the Slack app, set its
  GitHub secret, release, and delete the old webhook in Slack.
- **The PostHog key Grafana reads with,** `POSTHOG_GRAFANA_API_KEY`. Keep it a personal API key that
  can only read the project's queries, so a leak exposes analytics and nothing else. Rotate it in
  PostHog, set the GitHub secret, release, then revoke the old key.
- **The credentials OpenTofu signs in with,** such as the per-run Grafana token and
  `POSTHOG_TOFU_API_KEY`. They never reach the state, but they reach the plan saved for an apply.

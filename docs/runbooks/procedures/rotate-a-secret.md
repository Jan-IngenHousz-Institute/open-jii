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

The ids in these secrets, such as `AUTH_GITHUB_ID`, `CONTENTFUL_SPACE_ID` and the Mailchimp audience,
change only when the account behind them changes, not on rotation.

**The web build** also reads `CONTENTFUL_ACCESS_TOKEN` from the GitHub secret of the same name in each
environment. Set it there too before redeploying web, or the build uses the old key.

**The Contentful API key** carries two tokens, delivery and preview, and deleting the key revokes both.
So rotate them together from one new API key. Store its delivery token in all three places that hold
it: `contentful` `CONTENTFUL_ACCESS_TOKEN`, `status-contentful` `CONTENTFUL_ACCESS_TOKEN`, and the
`CONTENTFUL_ACCESS_TOKEN` GitHub secret the web build reads. Store its preview token as `contentful`
`CONTENTFUL_PREVIEW_ACCESS_TOKEN`. Redeploy backend and web, then check that the deployed web app
reads with the new token:

- Open a CMS page in German, such as `/de-DE/about`, right after the redeploy. Only English pages
  are built ahead, with the build's token, and published content is then cached for an hour, so an
  English page renders even when the stored token is wrong. The first German visit reads Contentful
  with the stored token.
- Open an editor's draft preview, which reads with the preview token and is never cached.

**Before deleting the old API key**, find everything else that uses it. Dev and prod read the same
Contentful space, and the mobile app builds a delivery token into every release
(`EXPO_PUBLIC_CONTENTFUL_ACCESS_TOKEN`), which installed versions keep using for alerts and the
force-update check. Contentful, Settings, API keys lists each key by name. If prod still uses the old
key, rotate it to the new key first. If a mobile release carries the old key, leave it until no
supported version does, or give mobile a key of its own. Only then delete the old key. Otherwise the
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

## Not covered yet

The Databricks webhook credentials, the Slack webhook used by Grafana, PostHog and Databricks, the
PostHog key Grafana uses, and the credentials OpenTofu generates still pass through OpenTofu. Changing
one of those is an infrastructure change until OJD-2122's second part moves them out; this page gains
their rows then.

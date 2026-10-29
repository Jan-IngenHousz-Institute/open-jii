# Provision the instrument-tracking OIDC client

This workflow creates and reconciles the first-party production client for
`Jan-IngenHousz-Institute/jii-instrument-tracking`. Its only callback is
`https://assets.openjii.org/api/auth/oauth2/callback/openjii`.

The client is an automation resource with `userId = null`. GitHub's protected main
and production approval environments authorize a dedicated ECS task. The command
creates no human account or session and exposes no HTTP administration endpoint.
Ordinary user sessions still cannot manage OAuth clients.

The approval job uses `prod-approval`, where another person must approve and
self-review is prevented. The task runs in `prod` only after that approval. The
workflow accepts dispatches from protected `main` and pins the already released
backend image; the development-only `approval-gate` is not used for this operation.

## Release prerequisites

1. Merge and release the OIDC provider and this provisioning change through the
   normal openJII main, dev and production path. Production discovery must answer
   at `https://api.openjii.org/api/v1/auth/.well-known/openid-configuration`.
2. Apply the tracked OpenTofu configuration through the existing infrastructure
   pipeline. `infrastructure/env/prod/oidc-client-provisioning.tf` defines the
   one-off task, its execution role, task role and SSM configuration. The private
   foundation supplies the real target role ARN from its applied OpenTofu output
   through the reviewed configuration helper. Before this PR's production plan,
   configure `INSTRUMENT_TRACKING_OIDC_PROVISIONER_ROLE_ARN` in both GitHub
   environments: `prod-plan` for read-only PR plans and `prod` for release
   plan/apply. Each workflow maps its environment's value to
   `TF_VAR_instrument_tracking_oidc_provisioner_role_arn`. Do not use a repository
   or global fallback, or a placeholder role value. No account IDs are stored in
   this public repository. The task
   reuses private migration subnets and their database security group. Its
   execution role reads only the database credential; the task role can only
   assume the sandbox secret-writer role.
3. Apply the sandbox bridge and app configuration through their pipelines. The
   target role is `arn:aws:iam::<sandbox-account>:role/jii-instrument-tracking-prod-oidc-provisioner`.
   It trusts only source role
   `arn:aws:iam::<openjii-prod-account>:role/ecs-task-role-oidc-client-provisioner-prod` and
   allows `DescribeSecret`, `PutSecretValue` and `UpdateSecretVersionStage` only on
   `jii/instrument-tracking/prod/oidc`. It has no `GetSecretValue` permission.
4. The destination secret must exist with zero versions for initial provisioning.
   Do not write a placeholder current value. The reconciler refuses an unmanaged
   current secret or an existing client with conflicting ownership/configuration.

No person creates these resources with a local CLI. Billing failures, missing
approvals or blocked required checks remain delivery gates; do not use a local
apply or direct database write to bypass them.

## Reconcile through GitHub

Run the workflow from `main` with the exact 40-character SHA of the backend
already deployed to production:

```bash
gh workflow run provision-oidc-client.yml \
  --repo Jan-IngenHousz-Institute/open-jii \
  --ref main \
  -f release_sha=<released-backend-commit> \
  -f operation=reconcile
```

The workflow verifies the release commit is on main, checks the production backend
is stable and runs that exact image pinned by ECR digest. It runs this command in
the private VPC using the tracked task definition:

```text
node node_modules/@repo/auth/dist/scripts/reconcile-oauth-client.js
  --client jii-instrument-tracking-prod --operation-id github-<workflow-run-id>
```

The fixed manifest binds the repository, ownership marker, callback, scopes,
authorization-code/refresh grants, PKCE and destination secret. The CLI checks its
actual AWS task-role identity before assuming the sandbox writer role. AWS
credentials and plaintext client credentials stay in process memory. The command
outputs only action, client ID and version ID. GitHub never reads, prints,
uploads or stores the client secret.

A successful initial run publishes JSON `{client_id,client_secret}` to the app's
secret. Deploy the instrument-tracking app through its own pipeline after this run
succeeds, so its ECS task loads the real credentials. Confirm its discovery,
login redirect, callback, session and admission behavior before release sign-off.

## Failure recovery and explicit rotation

A session advisory lock serializes operations for this client. Provisioning uses
three durable steps:

1. Write a new secret version labeled `AWSPENDING`.
2. Commit its canonical provider secret hash and version ID in the OAuth client.
3. Promote that version to `AWSCURRENT` and remove `AWSPENDING`.

An unchanged reconcile keeps the same secret. A failed pending write or database
commit leaves the existing current version unchanged. A failure after the database
commit is resumed by its recorded version ID, without reading the plaintext or
minting another secret. A lost promotion response is detected on retry. Rerun the
failed GitHub run to resume it; the operation ID stays the same across attempts.

The database and Secrets Manager have no shared transaction. Authentication can
fail between committing a new hash and promoting its version. Retry promptly to
finish promotion. Never repair this by editing a version or database row manually.

Rotation requires an app redeploy prepared in its own pipeline and an accepted temporary login interruption. The workflow refuses rotation unless `rotation_rollout_ready=true` explicitly confirms those prerequisites:

```bash
gh workflow run provision-oidc-client.yml \
  --repo Jan-IngenHousz-Institute/open-jii \
  --ref main \
  -f release_sha=<released-backend-commit> \
  -f operation=rotate \
  -f rotation_rollout_ready=true
```

After successful rotation, immediately redeploy instrument tracking through its
pipeline with fresh ECS tasks. Existing running tasks retain the old injected
secret and cannot exchange codes until replaced. Schedule a maintenance window
when that temporary login failure is unacceptable. A retry of the same workflow
run does not rotate twice. A fresh rotation run is a new intentional rotation.

Do not roll back only the app's secret version. The database hash must match it.
Recovery uses this same reconcile protocol or a new coordinated rotation.

## Verification

`apps/backend/src/oidc/oidc-client-provisioning.spec.ts` runs against real Postgres
and exercises the installed OAuth provider's token exchange with the reconciled
client. It covers secret-write failures, database rollback, interrupted promotion,
lost responses, retries, explicit rotation, conflicting records and concurrent
connections. Only the AWS secret service boundary uses an in-memory implementation.

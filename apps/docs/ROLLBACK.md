# Documentation deployment rollback

Use this runbook only for a failed docs deployment after the workflow has uploaded a rollback artifact. The deployment summary prints the exact artifact name. A first deployment from an empty bucket has no artifact because there is no previous site to restore.

The restore is destructive: `--delete` removes every key introduced by the failed deployment that is absent from the rollback artifact.

## 1. Set the deployment values

Use the failed documentation workflow run, its checked-out SHA, and the same environment/AWS region:

```sh
export ENVIRONMENT='dev'
export AWS_REGION='eu-west-1'
export DEPLOY_RUN_ID='<failed GitHub Actions run id>'
export DEPLOY_SHA='<full checked-out SHA from the deployment summary>'
export ARTIFACT_NAME="docs-rollback-${ENVIRONMENT}-${DEPLOY_SHA}"
export DOCS_BASE_URL='https://docs.dev.openjii.org'
export ROLLBACK_SMOKE_PATH='/docs/data-platform/mobile-app'
```

For production, set `ENVIRONMENT=prod` and `DOCS_BASE_URL=https://docs.openjii.org`. Copy `ARTIFACT_NAME` from the workflow summary instead of reconstructing it when possible.

Resolve the exact bucket and distribution from the same SSM parameters used by the deployment workflow:

```sh
export DOCS_BUCKET="$(aws ssm get-parameter \
  --region "$AWS_REGION" \
  --name "/docs/${ENVIRONMENT}/docs-bucket" \
  --query 'Parameter.Value' \
  --output text)"
export CLOUDFRONT_DISTRIBUTION_ID="$(aws ssm get-parameter \
  --region "$AWS_REGION" \
  --name "/docs/${ENVIRONMENT}/cloudfront-distribution-id" \
  --query 'Parameter.Value' \
  --output text)"
test -n "$DOCS_BUCKET"
test -n "$CLOUDFRONT_DISTRIBUTION_ID"
```

## 2. Download and inspect the artifact

```sh
export ROLLBACK_WORK_DIR="$(mktemp -d)"
mkdir -p "$ROLLBACK_WORK_DIR/site"
gh run download "$DEPLOY_RUN_ID" \
  --name "$ARTIFACT_NAME" \
  --dir "$ROLLBACK_WORK_DIR"
test -s "$ROLLBACK_WORK_DIR/${ARTIFACT_NAME}.tar.gz"
tar -tzf "$ROLLBACK_WORK_DIR/${ARTIFACT_NAME}.tar.gz" | sed -n '1,40p'
tar -xzf "$ROLLBACK_WORK_DIR/${ARTIFACT_NAME}.tar.gz" \
  -C "$ROLLBACK_WORK_DIR/site"
test -n "$(find "$ROLLBACK_WORK_DIR/site" -mindepth 1 -print -quit)"
```

Stop if the artifact is missing, empty, or contains an unexpected site. Do not continue with a different run's artifact.

## 3. Restore the exact previous key set

```sh
aws s3 sync "$ROLLBACK_WORK_DIR/site/" "s3://${DOCS_BUCKET}/" \
  --region "$AWS_REGION" \
  --delete \
  --only-show-errors
```

The `--delete` is required: it removes new keys from the failed deployment so the bucket's key/content set matches the captured site.

Verify the restored bucket independently by mirroring it back and comparing every path and byte:

```sh
mkdir -p "$ROLLBACK_WORK_DIR/verify"
aws s3 sync "s3://${DOCS_BUCKET}/" "$ROLLBACK_WORK_DIR/verify/" \
  --region "$AWS_REGION" \
  --delete \
  --only-show-errors
diff -qr "$ROLLBACK_WORK_DIR/site" "$ROLLBACK_WORK_DIR/verify"
```

`diff` must produce no output.

## 4. Invalidate CloudFront and wait

```sh
export INVALIDATION_ID="$(aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --paths '/*' \
  --query 'Invalidation.Id' \
  --output text)"
aws cloudfront wait invalidation-completed \
  --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --id "$INVALIDATION_ID"
```

## 5. Validate the rollback and the next attempt

Confirm the restored site's root and a route known to exist in that previous build:

```sh
curl --fail --silent --show-error --location \
  --output /dev/null "$DOCS_BASE_URL/"
curl --fail --silent --show-error --location \
  --output /dev/null "${DOCS_BASE_URL}${ROLLBACK_SMOKE_PATH}"
```

The first cutover rollback target is Docusaurus, whose redirect/404/search contract intentionally differs from the Fumadocs gate. The bucket mirror plus the two HTTP probes validate that rollback. Do not treat the new Fumadocs gate's expected failures against that old site as a restore failure.

Before attempting the Fumadocs deployment again, fix the failed SHA, build it locally, and rerun the complete local gate:

```sh
pnpm --filter docs build
pnpm --filter docs check-deploy-workflow
pnpm --filter docs validate:local
```

After the normal deployment workflow uploads that exact ref and finishes its CloudFront invalidation, rerun the remote gate explicitly:

```sh
pnpm --filter docs validate:deployment -- --base-url "$DOCS_BASE_URL"
```

Keep production blocked unless the dev remote gate is green and production deployment has explicit user approval.

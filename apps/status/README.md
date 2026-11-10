# openJII status page

The public status page for openJII, served at https://status.openjii.org in production and https://status.dev.openjii.org in dev. It is a Next.js static export (`output: "export"`) that lives in its own S3 bucket behind its own CloudFront distribution, apart from the platform, so a platform outage does not take it down.

The page holds no data of its own. In the browser it fetches `/data/status.json` through TanStack Query on load and every 60 seconds while the tab is visible, parses the file with the schema in `@repo/monitoring`, and shows each component's current state, 90 days of history, incidents and planned maintenance. A Lambda called the status publisher writes that file every minute (`infrastructure/modules/monitoring/status-publisher`). The page fetches again when the tab becomes visible and when the connection returns. When a refresh fails, the page keeps the last good document and adds a "We could not refresh this page" line above it. Once that document is more than five minutes old on the server's clock, whether or not a refresh failed, the headline reads "Status may be out of date" and the badges are muted. If the first fetch fails there is nothing to keep, so the page shows the "Status unavailable" card and tries again every minute.

The layout follows `apps/web`, with each part of the page in its own folder and every test beside the file it tests:

- `app/` holds the routes only: the layout, the page, the error and not-found pages, and `robots.txt`.
- `components/<part>/` holds one part of the page with the hooks and pure logic only it uses: `status-page` (the shell and what the page derives from a document), `headline`, `component-list`, `history`, `incidents`, and `shared` for pieces several parts use.
- `hooks/` holds the hooks several parts share, among them `use-status-document.ts`, which fetches the file.
- `lib/` holds logic several parts share, `providers/` the query and translation providers, and `test/` the render helpers and setup.
- `env.ts` validates the build settings below.

The history bars are about 8 to 11 px wide with a 2 px gap, under the 24 px target WCAG 2.5.8 asks for. They rely on its Equivalent exception: opening a component's row lists its problem days as text, so nothing a bar shows is reachable through the bar alone.

The page copy is in the `status` namespace of `@repo/i18n` (`packages/i18n/locales/<locale>/status.json`). The sample documents the tests use live beside the contract, in `packages/monitoring/src/status-fixtures.ts`.

## Run it locally

Node 24 is required. The page reads `@repo/monitoring`, `@repo/ui` and `@repo/i18n` from their source, so there is no package to build first:

```sh
pnpm install
```

Start the dev server, which serves http://localhost:3030:

```sh
pnpm --filter status dev
```

Only the dev server proxies `/data/*` to `STATUS_DATA_ORIGIN`, which is dev's live file unless you set it. A static export cannot rewrite, so `next.config.ts` adds the proxy for the dev server alone and a build stays a plain export.

To see a particular state, serve one of the sample documents instead and point the dev server at it:

```sh
pnpm status:fixtures incident
STATUS_DATA_ORIGIN=http://localhost:3031 pnpm --filter status dev
```

The samples are `operational`, `stale`, `incident`, `planned` and `maintenance`. The fixture server's `Date` header runs on from two minutes after the sample was generated, and the page takes its clock from that header, so a sample looks as it does in the tests and never goes stale.

Other commands, all with `--filter status`: `test`, `lint` and `check-types`. `pnpm run build --filter=status` writes the export to `apps/status/out`.

### Build variables

`env.ts` validates these. `STATUS_INDEXABLE` is `true` only in production. Any other value adds a `noindex` meta tag and makes `robots.txt` disallow everything. `STATUS_BASE_URL` is the public origin that metadata URLs resolve against; leave it unset locally. Both are listed under the build task in `turbo.json`, so changing either rebuilds instead of reusing the cache. `STATUS_DATA_ORIGIN` only changes where the dev server's proxy points, so a build ignores it.

## Deploy

`.github/workflows/deploy-status.yml` builds and deploys the page. `deploy.yml` calls it after the infrastructure job whenever `status` or a package it imports (`@repo/ui`, `@repo/i18n`, `@repo/monitoring`) is affected. To deploy by hand, run the workflow from the Actions tab with an environment and a ref, or put `status` in `deploy_app` on the dev or production release workflow. Runs for the same environment take turns. A run is never cancelled once it starts, but a run still waiting is replaced by a newer one.

The workflow takes the bucket and distribution from SSM (`/status/<env>/status-bucket` and `/status/<env>/cloudfront-distribution-id`), which the infrastructure apply creates. Then it runs these steps in order:

1. Build the export with the variables above.
2. Archive the live site, everything outside `data/`, as the workflow artifact `status-rollback-<env>-<sha>`, kept for 30 days. A first deploy has nothing to archive.
3. Record whether `data/status.json` already exists, for the gate at the end.
4. Upload without removing anything live. New assets go first with `max-age=31536000`. HTML follows with `max-age=0, must-revalidate`, then `.xml` and `.txt` with `max-age=86400`. A last pass with `--delete` removes keys the new build no longer has. The live `index.html` therefore never points at a file that is missing.
5. Invalidate `/*` on CloudFront and wait for it to finish.
6. Run the gate against the public URL. `/` must return 200 with the page title, and so must the first CSS file and the first JS file that `index.html` references. `robots.txt` must return 200 and allow crawling in production and disallow it elsewhere. `/data/status.json` must be a JSON object whose `Cache-Control` includes `max-age=30`. A 404 for that file fails the gate if the file existed before the deploy, and only warns on a first deploy that beat the publisher's first run.

## The data directory belongs to the publisher

The publisher writes `data/status.json` with `Cache-Control: public, max-age=30, stale-if-error=86400`. A deploy must never delete or overwrite it. Every upload, prune and archive command in `deploy-status.yml` excludes `data/*`, and so does the restore below. Nothing under `data/` in the build output is uploaded, and `aws s3 sync --delete` leaves excluded keys alone. If the file stops updating, see `docs/runbooks/status-publisher-stopped.md` and `docs/runbooks/status-publisher-errors.md`.

## The document contract

`packages/monitoring/src/status-document.ts` defines the file. The publisher validates every document against `statusDocumentSchema` before it writes. The page parses with `readableStatusDocumentSchema`, which is the same schema except that it drops components whose `id` is not in the page's own list. A component added in the publisher first therefore does not break pages built before it.

Older pages also ignore keys they do not know, so adding an optional field is safe. Anything else is a change an older page cannot read: a new required field, a removed or renamed field, a new value in an enum such as a component state or an incident stage, or a new `STATUS_DOCUMENT_VERSION`. A page that fails to parse a document treats it like a failed fetch and keeps showing the last good one until it goes stale.

Ship such a change in two deploys. First deploy a page that reads both the old and the new shape, and wait until it is live in every environment. Then change the publisher. One deploy run applies the infrastructure, which includes the publisher, before it builds the page, so a single PR that changes both puts the new shape out first. Open tabs keep running the page they loaded until they reload. Rolling the page back past a contract change has the same problem in reverse.

## Rollback

Run `deploy-status.yml` again with the environment and the previous good commit SHA as `ref`. Leave `ref` empty and it deploys the latest commit of the branch you picked. The run rebuilds that ref, applies the same cache headers, prunes what the newer build added, invalidates CloudFront and runs the gate. It leaves `data/` alone.

Do not use the docs site's recipe in `apps/docs/ROLLBACK.md` here. It restores with `aws s3 sync --delete` and no excludes, which deletes the publisher's `data/` objects, and the file stays missing until the next publisher run. It also drops the cache headers.

If a rebuild is not possible, restore the archive from the failed deploy's run. Take the run id and the SHA from that run, and the region and environment from the workflow summary. The commands apply the same excludes and the same cache headers as the deploy:

```sh
export ENVIRONMENT='dev'
export AWS_REGION='<region>'
export DEPLOY_RUN_ID='<failed run id>'
export DEPLOY_SHA='<full SHA of the failed deploy>'
export ARTIFACT_NAME="status-rollback-${ENVIRONMENT}-${DEPLOY_SHA}"

export STATUS_BUCKET="$(aws ssm get-parameter --region "$AWS_REGION" \
  --name "/status/${ENVIRONMENT}/status-bucket" \
  --query 'Parameter.Value' --output text)"
export CLOUDFRONT_DISTRIBUTION_ID="$(aws ssm get-parameter --region "$AWS_REGION" \
  --name "/status/${ENVIRONMENT}/cloudfront-distribution-id" \
  --query 'Parameter.Value' --output text)"

export WORK_DIR="$(mktemp -d)"
mkdir "$WORK_DIR/site"
gh run download "$DEPLOY_RUN_ID" --name "$ARTIFACT_NAME" --dir "$WORK_DIR"
tar -xzf "$WORK_DIR/${ARTIFACT_NAME}.tar.gz" -C "$WORK_DIR/site"
cd "$WORK_DIR/site"

aws s3 sync . "s3://${STATUS_BUCKET}/" \
  --cache-control "public, max-age=31536000" \
  --exclude "*.html" --exclude "*.xml" --exclude "*.txt" --exclude "data/*" \
  --only-show-errors
aws s3 cp . "s3://${STATUS_BUCKET}/" --recursive \
  --exclude "*" --include "*.html" --exclude "data/*" \
  --cache-control "public, max-age=0, must-revalidate" \
  --only-show-errors
aws s3 cp . "s3://${STATUS_BUCKET}/" --recursive \
  --exclude "*" --include "*.xml" --include "*.txt" --exclude "data/*" \
  --cache-control "public, max-age=86400" \
  --only-show-errors
aws s3 sync . "s3://${STATUS_BUCKET}/" --delete --size-only --exclude "data/*" \
  --only-show-errors

INVALIDATION_ID="$(aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths '/*' \
  --query 'Invalidation.Id' --output text)"
aws cloudfront wait invalidation-completed \
  --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --id "$INVALIDATION_ID"
```

Then load the page and `/data/status.json` in a browser. The restored site is not on any commit the workflow knows about, so run `deploy-status.yml` with a known-good ref when you can to bring it back in line.

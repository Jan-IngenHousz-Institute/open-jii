# openJII Docs

The openJII documentation site, built with [Fumadocs](https://fumadocs.dev/) (framework mode) on Next.js and exported as a static site.

Content lives in `content/` as MDX, organized into two tabs backed by fumadocs-mdx root folders:

- `content/guide/**` — researcher-facing guide (`/guide/*`)
- `content/developers/**` — developer reference (`/developers/*`)

The API Reference tab (`/api/*`) is generated from the platform's OpenAPI and AsyncAPI specs (added in a later ticket).

## Local development

```
pnpm dev --filter=docs
```

Serves on http://localhost:3010.

## Build

```
pnpm run build --filter=docs
```

Produces a static export in `out/` (`next.config.mjs` sets `output: "export"`). Built-in Orama search is precomputed at build time and served from `out/api/search`.

## Local static-export validation

The checked-in local server mirrors the CloudFront viewer-request behavior: legacy redirects return 301, clean page URLs resolve to flat `.html` objects, `/api/search` remains an extensionless static index, and missing routes serve `404.html` with HTTP 404.

```sh
pnpm --filter docs serve
pnpm --filter docs validate:deployment -- --base-url http://127.0.0.1:3010
```

For a one-command local gate with an ephemeral port:

```sh
pnpm --filter docs validate:local
```

The gate uses the local `out/` directory as the authoritative route inventory, crawls every exported HTML page and its internal targets over HTTP, checks all `redirects.json` entries and destinations, verifies the real 404, checks meaningful REST/MQTT markers, runs sampled Orama searches, and derives web-app docs deep links from production source before checking their destinations.

Run the same gate against a deployed origin after building the exact ref being validated:

```sh
pnpm --filter docs validate:deployment -- --base-url https://docs.dev.openjii.org
```

For recovery after a failed deployment, follow the copyable [rollback runbook](./ROLLBACK.md). The deployment summary prints the exact GitHub artifact name to download.

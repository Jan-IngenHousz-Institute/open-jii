# Environments

Where each environment lives and how an agent reaches it without a browser. Account ids,
workspace hosts and warehouse ids stay out of this public repo; each person's CLI configuration
holds them.

| Environment | Web                       | API                           | Cloud access                                  |
| ----------- | ------------------------- | ----------------------------- | --------------------------------------------- |
| local       | `http://localhost:3000`   | `http://localhost:3020`       | none; AWS and lakehouse features are dead     |
| dev         | `https://dev.openjii.org` | `https://api.dev.openjii.org` | AWS profile `openjii-dev`, Databricks `dev`   |
| prod        | `https://openjii.org`     | `https://api.openjii.org`     | AWS profile `openjii-prod`, Databricks `prod` |

The AWS profile names and their one-sign-in `sso-session` are set up as in
`tooling/devkit/README.md`. Databricks profiles are named after the environment;
`databricks auth profiles` lists yours and `databricks warehouses list -p <env>` finds a warehouse.

## Signing in without a browser

An agent's browser tab is often one the person never sees. Print the command and let the person run
it:

```bash
aws sso login --sso-session openjii --use-device-code --no-browser
BROWSER=none databricks auth login -p <env>
```

When a session expires mid-task, ask for every expired login at once rather than one per failure.

## Production

Read production when the person asks for it. Write to it only through the release path: PR, then
`main`, then dev, then a release. A direct CLI write to a shared resource, such as a cluster policy
edit, has taken the production pipeline down before.

## The dev API with an API key

A personal API key, created in the platform's account settings, signs requests in as its owner:

- `curl -H "x-api-key: $KEY" https://api.dev.openjii.org/api/v1/...` for the REST API.
- A Playwright context with `extraHTTPHeaders: { "x-api-key": KEY }` opens `https://dev.openjii.org`
  already signed in, with no one-time code.
- Account-management routes (API keys, passkeys, organization updates) refuse a key and need a real
  sign-in; `packages/auth/src/api-key-session.ts` says why.
- Dev throttles at roughly 20 to 30 quick requests per key, so pace parallel agents.
- Name test data with a `QA-<date>-` prefix, and never test with a production key.

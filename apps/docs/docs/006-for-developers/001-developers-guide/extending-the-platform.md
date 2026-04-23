# Extending the Platform

## Adding a new transactional email

Transactional emails (OTP, notifications, etc.) are content-driven: the copy lives in Contentful as a `ComponentEmail` entry and the code in `packages/transactional` fetches, interpolates, and renders it. Follow the steps below to add a new one end-to-end.

### 1. Create the content entry in Contentful

1. Open Contentful → **Content** → **Add entry** → `ComponentEmail`.
2. Fill in the required fields:
   | Field | Purpose |
   |---|---|
   | `internalName` | e.g. `my-new-email`. Must be unique. |
   | `preview` | Short preview text shown in email clients (supports `{{variables}}`). |
   | `content` | Rich Text body. Use embedded `ComponentButton` entries for CTA buttons. |
3. Publish the entry.

Wrap any dynamic value in double curly braces: `{{experimentName}}`, `{{actor}}`, etc. The render layer replaces them with real values at send time.

### 2. Wire it up in code

Register the new `internalName` in `CmsEmailType`, add a render function under `packages/transactional/src/render/`, export it from the package, and call it from the relevant backend service. Follow the existing emails as a reference.

### 3. Render emails locally for testing

```bash
# From the repo root:
pnpm --filter @repo/transactional test:render
```

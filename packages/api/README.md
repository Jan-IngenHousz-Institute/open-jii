# @repo/api

The oRPC API contract shared across the monorepo. Endpoints, inputs, and outputs are defined once here with [oRPC](https://orpc.unnoq.com) contracts and Zod schemas; the backend implements them (`@orpc/nest`) and the web and mobile apps consume them with fully typed clients.

The OpenAPI spec for the docs site's API reference is generated from this contract:

```bash
pnpm --filter @repo/api generate:openapi
```

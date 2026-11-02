# @repo/cms

Contentful data access shared by web, mobile and transactional email: GraphQL clients, queries,
generated types, configuration and alert severity helpers. CMS web components and live preview
live under `apps/web/components/cms` and are imported from their owning modules, for example
`~/components/cms/home/hero`.

This package has no dependency on `@repo/ui`. Backend and mobile can consume CMS data without web
presentation changes triggering their builds or releases. `pnpm lint:boundaries` checks this rule
for CMS, backend and mobile, including transitive workspace dependencies. It also keeps shared UI
independent of CMS. CI runs it on every PR.

Regenerate GraphQL types after content-model changes:

```bash
pnpm --filter @repo/cms codegen
```

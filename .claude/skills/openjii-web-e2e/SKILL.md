---
name: openjii-web-e2e
description: Write, run, debug, or review openJII browser end-to-end tests.
---

# OpenJII web end-to-end tests

Read `AGENTS.md` first, then follow the end-to-end harness documentation. For local bring-up, run
`pnpm db:setup`, `pnpm --filter database db:seed`, and `pnpm dev:fb`. Obtain a session cookie with
`pnpm local:login`.

Keep tests user-visible, deterministic, and scoped to the requested flow. If documentation and code
disagree, verify the implementation and update the owning documentation.

# Testing

How tests are written and where they go, across every workspace. There are 1,482 test files today
and the conventions genuinely differ per workspace, so the table below is the reference rather than
a single house rule.

Testing `apps/web` in detail is `apps/web/TESTING.md`, which is 227 lines and worth reading before
you write a web test. This document does not repeat it.

## Read first

- `apps/web/TESTING.md` if you are anywhere near the web app.
- `apps/backend/src/test/test-harness.ts` if you are anywhere near the backend.
- `tooling/vitest-config/src/configs/base-config.ts` for what every vitest project inherits.

## Where tests live

| Workspace        | Runner               | Suffix            | Placement                                         | Harness                                                 |
| ---------------- | -------------------- | ----------------- | ------------------------------------------------- | ------------------------------------------------------- |
| `apps/backend`   | vitest, node         | `.spec.ts` (281)  | colocated                                         | `src/test/test-harness.ts`, real Postgres               |
| `apps/web`       | vitest, jsdom        | `.test.tsx` (902) | colocated, except 83 under `app/` in `__tests__/` | `test/test-utils.tsx`, `test/factories.ts`, `test/msw/` |
| `apps/mobile`    | vitest, two projects | `.test.ts` (127)  | colocated                                         | `vitest.setup.ts`, `@repo/vitest-config/mobile`         |
| `apps/data`      | pytest               | `test_*.py` (16)  | flat `tests/lib/`                                 | `tests/conftest.py`, local Spark and a fake `dlt`       |
| `apps/e2e`       | playwright           | `.spec.ts` (2)    | own package                                       | a running stack                                         |
| `packages/api`   | vitest, node         | `.spec.ts` (43)   | colocated                                         | none needed                                             |
| `packages/iot`   | vitest, node         | `.spec.ts` (22)   | colocated                                         | `src/driver/testing/mock-transport.ts`                  |
| `packages/ui`    | vitest, jsdom        | `.test.tsx` (64)  | all in `__tests__/`                               | none                                                    |
| `packages/auth`  | vitest, node         | both, 3 and 2     | colocated                                         | none                                                    |
| `tooling/devkit` | vitest, node         | `.test.ts` (19)   | colocated                                         | fixture clients                                         |

`packages/analytics`, `cms`, `database`, `i18n` and `transactional` have no tests and no vitest
configuration at all.

## Rules

1. New code ships with tests, and so does a substantive change to existing code, whenever the area
   already has test infrastructure. The five packages with no tests are the only places where
   adding one means setting up a runner first. [review]
2. Use the suffix and placement your workspace already uses. Do not introduce a third convention,
   and do not rename existing files to match a different one. [review]
3. Mock at system boundaries and nowhere else. The network, the clock, a native module, an external
   service. Anything inside the boundary runs for real, because a test that mocks its own subject
   proves the mock works. [review]
4. In `apps/web`, prefer MSW over `vi.mock` for anything that fetches, and do not `vi.mock` a local
   module at all. The suite runs with `isolate: false`, so files in a worker share a module cache
   and a file-scoped mock leaks into whichever file runs next. MSW does not touch the module graph,
   which is why it is immune. [review]
5. Stub a global in `apps/web` with `vi.stubGlobal` and clear it with `vi.unstubAllGlobals`, never
   with a bare `Object.defineProperty`, for the same shared-worker reason. A hand-defined global
   survives into the next file and fails something unrelated. [review]
6. The one component family to mock in a web test is `@repo/ui/components/charts/*`. Plotly needs a
   real layout engine and WebGL, renders nothing useful under jsdom and is slow to mount, so mock
   the specific chart and assert on the props it receives. [review]
7. Address an endpoint through the contract, never through a literal URL. The backend uses
   `resolveOrpcPath(contract...)` and the web MSW helper takes the contract procedure itself, so a
   contract change breaks the test rather than leaving it passing against a route that no longer
   exists. [review]
8. Assert behaviour, not lines. A test that would still pass if the logic inverted is not a test.
   Cover the empty case, the single case, the many case, the error path, and the one where the
   caller goes away mid-flight. [review]
9. A device double comes from the firmware or the vendor's source, not from your understanding of
   the protocol. A fake that agrees with your mental model and disagrees with the device is worse
   than no fake. [review]
10. Fix or delete a flaky test, and never paper over it with a retry. Name the cause in the commit,
    because the cause is usually a real race that users can hit too. [review]
11. Do not lower a coverage floor to make a change pass. `apps/mobile` is the only workspace with
    enforced thresholds: 35% globally, and per layer 85% on `features/**/domain/**`, 75% on
    `shared/db/**`, 70% on `features/**/hooks/**` and `shared/api/**`, and 65% on
    `features/**/services/**`. Everywhere else coverage is reported and not gated.
    [ci: Build, Lint, & Test]

## Patterns

**Mounting a web response.** `server.mount(contract.experiments.listExperiments, { body })` takes
the procedure and derives the method, the URL and the status from it, returning a spy you can assert
calls on. There is no handler to write and no URL to keep in step.

**Typed fixtures.** `apps/web/test/factories.ts` builds entities from the contract's own types, so a
field that changes shape breaks the factory once instead of breaking forty tests in confusing ways.

**A backend controller spec.** Go through `TestHarness.App`, create a user with `createTestUser`,
and use the supertest verbs that carry a session. It talks to a real Postgres on port 5433 that
`pretest` starts and `posttest` tears down, so running vitest directly needs `db:test:setup` first.
Run that suite on its own: its timeouts are tight enough that a parallel turbo run makes healthy
tests fail.

**A pipeline test without Databricks.** `tests/conftest.py` provides a session-scoped local Spark
and a fake `dlt` module whose decorators are identity functions, which is what lets a pipeline file
be imported and exercised outside a Databricks runtime.

**Fixture names that collide.** Postgres full-text search uses trigram matching, so an unseeded
random name can match a fixture you did not intend. A unique suffix needs to be at least ten
characters before the collision probability stops mattering.

## Known debt

`packages/ui` keeps all 64 of its test files in `__tests__/` directories while the rest of the repo
colocates. Worse, `src/**` is excluded from the type-aware lint configuration there, so those tests
are close to the only automated check those 65 components get. No ticket.

`packages/auth` is the only workspace using both suffixes, with three `.spec.ts` and two `.test.ts`.
Normalising the two is a rename. No ticket.

`packages/analytics`, `cms`, `database`, `i18n` and `transactional` have no tests. The schema is
covered indirectly by the backend suite, and the others are not covered at all, including the
Contentful client that both web and mobile depend on. Needs a ticket.

`apps/web/test/msw/mount.ts` and `packages/api/src/contract.spec.ts` both read oRPC's internal
`"~orpc"` field, so an oRPC upgrade can break the web harness and the contract guard at the same
time, in two places that look unrelated. No ticket.

`apps/data` runs ruff and pyright over `src/lib` and `tests` only. The pipelines and tasks that run
in production are excluded from both, and the 16 pytest files cover the libraries rather than the
pipelines. Needs a ticket.

`apps/backend/test/app.e2e-spec.ts` and its `jest-e2e.json` are a Jest harness nothing runs. No
ticket.

## Decisions

- 2026-09-21. Suffix and placement stay per workspace instead of being unified. A repo-wide rename
  would touch about 350 files, break the backend's layer sequencer and every vitest `include`
  pattern, and change no behaviour.
- 2026-09-21. The 83 web tests under `app/**/__tests__/` stay where they are, because route folders
  should hold only the files Next treats specially. Everywhere else in the web app, colocated is the
  rule.

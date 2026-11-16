# Testing

How tests are written and where they go, across every workspace. There are 1,976 test files today
and the conventions genuinely differ per workspace, so the table below is the reference rather than
a single house rule.

Testing `apps/web` in detail is `apps/web/TESTING.md`, which is 227 lines and worth reading before
you write a web test. This document does not repeat it.

## Read first

- `apps/web/TESTING.md` if you are anywhere near the web app.
- `apps/backend/src/test/test-harness.ts` if you are anywhere near the backend.
- `tooling/vitest-config/src/configs/base-config.ts` for what every vitest project inherits.

## Where tests live

| Workspace                  | Runner                 | Suffix                              | Placement                            | Harness                                                                   |
| -------------------------- | ---------------------- | ----------------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| `apps/backend`             | vitest, node           | `.spec.ts` (368)                    | colocated                            | `src/test/test-harness.ts`, real Postgres, quiet worker doubles           |
| `apps/web`                 | vitest, jsdom          | `.test.tsx` (894), `.test.ts` (192) | colocated, except 91 in `__tests__/` | `test/test-utils.tsx`, `test/factories.ts`, `test/msw/`                   |
| `apps/status`              | vitest, jsdom          | `.test.tsx` (20), `.test.ts` (8)    | colocated, 8 in `app/__tests__/`     | `test/test-utils.tsx`, `vitest.setup.ts`, a fixed time zone               |
| `apps/mobile`              | vitest, two projects   | `.test.ts` (122), `.test.tsx` (63)  | colocated                            | `vitest.setup.ts`, `@repo/vitest-config/mobile`                           |
| `apps/data`                | pytest                 | `test_*.py` (54)                    | flat `tests/lib/`                    | `tests/conftest.py`, local Spark, fakes for `dlt` and `pyspark.pipelines` |
| `apps/calibration-sandbox` | unittest, in the image | `test_*.py` (3)                     | `tests/`                             | the sandbox image                                                         |
| `apps/macro-sandbox`       | vitest                 | `test/test.ts`, `.spec.ts` (1)      | `test/`                              | the composed stack, skipped without `MACRO_SB_TEST_KEY`                   |
| `apps/e2e`                 | playwright, vitest     | `.spec.ts` (11), `.test.ts` (1)     | `specs/`, `ticket-screens/`          | a running stack, nightly                                                  |
| `packages/api`             | vitest, node           | `.spec.ts` (54)                     | colocated                            | none needed                                                               |
| `packages/iot`             | vitest, node           | `.spec.ts` (34)                     | colocated                            | `src/driver/testing/mock-transport.ts`                                    |
| `packages/ui`              | vitest, jsdom          | `.test.tsx` (77), `.test.ts` (8)    | all in `__tests__/`                  | none                                                                      |
| `packages/monitoring`      | vitest, node           | `.test.ts` (12)                     | colocated                            | sample documents in `src/status-fixtures.ts`                              |
| `packages/auth`            | vitest, node           | `.spec.ts` (5), `.test.ts` (5)      | colocated                            | none                                                                      |
| `packages/analytics`       | vitest, node           | `.test.ts` (5)                      | colocated                            | none                                                                      |
| `tooling/devkit`           | vitest, node           | `.test.ts` (39)                     | colocated                            | fixture clients, and the real hook scripts run in a scratch directory     |

`packages/cms`, `database`, `i18n` and `transactional` have no tests and no vitest configuration at
all.

The `apps/macro-sandbox` tests need Docker and the key `MACRO_SB_TEST_KEY`, and the suite skips
with a message when the key is unset, so a green run without the key means nothing ran. The browser
suite in `apps/e2e` runs nightly and on demand, not on pull requests, so a change that breaks it is
found the next morning.

## Rules

1. New code ships with tests, and so does a substantive change to existing code, whenever the area
   already has test infrastructure. The four packages with no tests are the only places where
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
11. Do not lower a coverage floor to make a change pass. `apps/mobile` is the only workspace whose
    own vitest config enforces thresholds: 35% globally, and per layer 85% on
    `features/**/domain/**`, 75% on `shared/db/**`, 70% on `features/**/hooks/**` and
    `shared/api/**`, and 65% on `features/**/services/**`. Coverage is generated only in CI or with
    `COVERAGE=1`, so a single-file run never trips them. The coverage service also reports project
    and patch statuses from `codecov.yml`, and the repository ruleset decides whether any of them
    blocks a merge. [ci: Build, Lint, & Test]

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

**A pipeline test without Databricks.** `tests/conftest.py` provides a session-scoped local Spark,
a fake `dlt` module whose decorators are identity functions, and a fake `pyspark.pipelines` that
records the sinks and flows a notebook defines, which is what lets a pipeline file be imported and
exercised outside a Databricks runtime. Tests that need Spark carry the `spark` marker, and tests
against a real ClickHouse carry `clickhouse` and skip unless `CLICKHOUSE_TEST_URL` is set.

**A scheduled worker.** The harness boots the whole application, so a background loop would act on
rows another spec queued. Give the worker a quiet subclass in `apps/backend/src/test/` that skips
the schedule and leaves the method a spec calls, such as `drain()` or `reconcile()`, real, then call
that method from the spec.

**A page driven by a data document.** `apps/status` renders a static document that a lambda writes,
so its tests build documents from `packages/monitoring/src/status-fixtures.ts`, the sample set that
lives beside the contract, and pin the time zone to one with daylight saving so a date read in
local time fails here.

**Fixture names that collide.** Postgres full-text search uses trigram matching, so an unseeded
random name can match a fixture you did not intend. A unique suffix needs to be at least ten
characters before the collision probability stops mattering.

## Known debt

`packages/ui` keeps all 85 of its test files in `__tests__/` directories while the rest of the repo
colocates. Worse, `src/**` is excluded from the type-aware lint configuration there, so those tests,
the type check and a few theme and React hooks rules are all the automated checking the 66
components get. No ticket.

`packages/auth` uses both suffixes for the same runner, with five `.spec.ts` and five `.test.ts`.
`apps/e2e` has both too, but there the suffix says which runner owns the file. Normalising the auth
pair is a rename. No ticket.

`packages/cms`, `database`, `i18n` and `transactional` have no tests. The schema is covered
indirectly by the backend suite, and the others are not covered at all, including the Contentful
client that both web and mobile depend on. Needs a ticket.

`apps/web/test/msw/mount.ts`, `packages/api/src/contract.spec.ts` and the backend's
`TestHarness.resolveOrpcPath` all read oRPC's internal `"~orpc"` field, as does the backend's
`orpc-error.interceptor.ts`, so an oRPC upgrade can break the web harness, the contract guard and
the backend harness at once, in places that look unrelated. No ticket.

`apps/data` runs ruff and pyright over `src/lib` and `tests` only. The pipelines and tasks that run
in production are excluded from both, and the 54 pytest files cover the libraries rather than the
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
- 2026-11-16. Reconciled with main, where 36 web tests sit under `app/**/__tests__/` rather than the
  83 counted above and 55 more sit in `__tests__` directories outside `app/`, which the reason given
  does not cover.

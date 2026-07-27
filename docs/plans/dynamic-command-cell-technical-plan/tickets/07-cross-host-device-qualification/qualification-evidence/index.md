---
title: "Ticket 7 qualification evidence, rollout readiness, and MultispeQ record"
kind: spec
---

# Ticket 7 qualification evidence

Automated qualification of the cross-host dynamic command flow (protocol → Python macro `{ toDevice }` → ref command → command reply) on the uncommitted Ticket 1–6 work in worktree `traycer-open-jii-polite-badger`. All runs on Node v24.18.0, pnpm 11.15.0, 2026-07-23.

## 1. Qualification fixtures added (all NEW files)

| Layer | File | Coverage |
| --- | --- | --- |
| Shared (`packages/api`) | `src/transforms/dynamic-command-qualification.spec.ts` (15 tests) | Canonical chain incl. workbook↔flow round trip, one-device chain + reply chaining, two-device differing strings, shared question fan-out, loop refresh, branch skip, visually-later goto source, missing/empty/non-string field, stale epoch, prior workbook version, one-device source failure + partial success, reconnect id change, identifier-only failure diagnostics |
| Mobile (`apps/mobile`) | `src/features/measurement-flow/domain/mobile-dynamic-command-qualification.test.ts` (12 tests) | Canonical chain through the real persisted stores + `resolveMobileCommand`, two-device, shared question via answers store, reconnect + repair, retry/new-iteration epoch invalidation, version change clears outputs & answers, same-version refetch preserves cycle, restart resume of the full chain, valid v1→v2 migration (guard-accepted, resolver-visible), malformed resume state → coordinated reset, telemetry log-field allowlist |
| Web (`apps/web`) | `hooks/workbook/useWorkbookExecution/useWorkbookExecution.dynamic-qualification.test.ts` (4 tests) | Canonical chain end-to-end through `useWorkbookExecution` (real macro fan-out via mocked server macro), one-device chain + reply chaining, two-device differing strings with per-device previews, one-device source failure partial success with telemetry-safety assertion, workbook-change invalidation before transport |
| Backend (`apps/backend`) | `src/workbooks/presentation/dynamic-command-qualification.spec.ts` (5 tests) | UNMOCKED lifecycle against the real DB + HTTP boundary: publish gate default-off in the environment, published dynamic version refused over HTTP without capability (426, no cells/ref/field leak), served intact with `x-openjii-capabilities: dynamic-command-ref-v1`, static version fetch unchanged without capability, refusal logs carry codes/ids only |

These sit on top of the Ticket 1–6 suites already in the worktree (shared resolver/scope/freshness matrix, publish/capability unit + controller specs, web ticket-5 epoch/branch/race suite, mobile store migration/rehydration-guard/measurement-capture suites), which remain green and are counted in the full-gate numbers below.

## 2. Commands executed and results

Environment: Node v24.18.0 (`.nvmrc` = 24), pnpm 11.15.0. Backend suites require the test database: `pnpm --dir packages/database run db:test:setup` (compose project `database-test`, port 5433) — run before the backend commands below.

| # | Command (from repo root unless noted) | Result |
| --- | --- | --- |
| 1 | `packages/api`: `npx vitest run src/transforms src/domains/workbook` | 18 files, **358 passed** (includes the 15 new qualification tests) |
| 2 | `apps/mobile`: `npx vitest run` (full suite) | 90 files, **937 passed** (includes the 12 new qualification tests) |
| 3 | `apps/web`: `CI=1 npx vitest run` (full suite) | 673 files, **4871 passed, 2 skipped** (includes the 4 new qualification tests) |
| 4 | `apps/backend`: `npx vitest run src/workbooks` | 12 files, **109 passed** (includes the 5 new qualification tests) |
| 5 | `pnpm exec turbo run check-types` | **4/4 tasks successful** (repo equivalent of `pnpm typecheck`; the root `typecheck` script points at a task name turbo does not define — see deviations) |
| 6 | `packages/api`: `pnpm typecheck` (`tsc --noEmit`) | **Pass** |
| 7 | `CI=1 pnpm exec turbo test --concurrency 4 --continue` (repo `pnpm test` equivalent) | See §2a |
| 8 | `pnpm build:affected` | See §2a |

### 2a. Full-gate results

- `CI=1 pnpm exec turbo test --concurrency 4 --continue`: **15/16 tasks successful** in 1m08s. The only failure is `data#test` (`apps/data`, `uv run pytest`): under turbo the Spark session fixture cannot start a JVM because turbo's strict env does not pass `JAVA_HOME` through; the identical suite passes standalone (`pnpm --dir apps/data run test`: **64 passed**). `apps/data` has zero changes in this worktree; this is a pre-existing local-environment constraint (the repo already notes pytest needs a Spark-safe JDK), not a dynamic-command regression.
- `pnpm build:affected`: **11/11 tasks successful** in 1m28s (includes backend `nest build`, web, mobile-affected packages).

### Deviations and environment notes

- **Root `pnpm typecheck` does not work in this repo**: it runs `turbo run typecheck`, but turbo.json only defines `check-types`. The repository-approved equivalent `turbo run check-types` was used (plus direct `tsc --noEmit` for `packages/api`, whose script name is `typecheck` and is not registered as a turbo task). No task named `typecheck` exists for backend; its types are enforced by `nest build` (covered by the build gate).
- `apps/backend` `tsc --noEmit -p tsconfig.json` reports a pre-existing type conflict inside `vitest.config` caused by two `@types/node` majors in the pnpm store (duplicate vite type identities). Unrelated to this ticket; not a repo gate.
- The first `pnpm test` at default concurrency 20 produced flaky web/mobile failures that did not reproduce in isolation (both full suites pass standalone) and an `apps/data` (`uv run pytest`) failure that also passes standalone (64/64). The recorded gate was run at `--concurrency 4`.

## 3. Invariant coverage map (ticket acceptance criteria → evidence)

| Acceptance criterion | Evidence |
| --- | --- |
| Both hosts complete the canonical flow and retain the reply as a later source | web qualification tests 1–2; mobile qualification test 1; shared tests "completes the one-device chain…" |
| Two devices receive only their own computed strings | shared, web, and mobile "two devices" tests (transport call lists asserted exactly) |
| Shared question `answer` reaches both devices unchanged | shared + mobile qualification tests; existing web ticket-5 test |
| Every stale/ambiguous/cross-device/unsupported case fails before transport | shared suite asserts `transport` never called for: branch skip, goto-later source, missing/empty/non-string field, stale epoch, prior version, reconnect; web workbook-change test asserts zero transport; backend 426 test proves no payload for unsupported clients |
| Valid mobile resume survives restart/upgrade; malformed/cross-version resets | mobile qualification: restart resume, v1→v2 migration accepted, malformed resume → `FLOW_RESUME_STATE_INVALID` reset, version change clears state |
| Static string/JSON/YAML, branch, offline cache, upload, publish regressions green | full web/mobile/backend/api suites above (0 failures) |
| Logs contain ids/codes/provenance only | shared "identifiers only" test; mobile telemetry field-allowlist test; web source-failure telemetry assertion; backend refusal-log test |
| Real hardware matches the automated safety contract | **PENDING — requires a human with a MultispeQ; template in §5** |
| Readiness record confirms all three rollout switches off | §4 |

## 4. Rollout readiness checklist (for rollout operators)

Verified in this worktree on 2026-07-23. **No rollout action was taken by this qualification.**

DYNAMIC_COMMAND_AUTHORING web feature flag: default OFF. packages/analytics/src/feature-flags.ts maps it to false in the fallback map; the command cell resolves the flag with ?? false when analytics is unavailable. No PostHog-side enablement was made.DYNAMIC_COMMAND_PUBLISH_ENABLED backend kill switch: OFF. It is an environment variable read strictly as === "true"; it is unset in all checked-in configuration, and the backend qualification spec asserts the default environment blocks dynamic publication (DYNAMIC_COMMAND_PUBLISH_DISABLED). No deployment or env configuration was changed.CMS minimum mobile version: UNTOUCHED. No Contentful/CMS force-update entry was created or edited; the worktree diff contains no CMS/force-update changes (verified via git status/diff scan).No monitoring or deployment configuration was changed.Real MultispeQ verification (§5) completed on both hosts — required before enabling any of the three switches.Release sequence honored (technical plan §8): deploy server + runtime with publication disabled → ship capability-advertising web/mobile → set CMS minimum version → enable DYNAMIC_COMMAND_PUBLISH_ENABLED → enable DYNAMIC_COMMAND_AUTHORING for internal users → expand.

## 5. Manual MultispeQ verification record — TEMPLATE (status: PENDING)

Real-hardware qualification requires a human operator with a MultispeQ. **Nothing below is filled in; do not treat this section as executed evidence.** If any hardware result contradicts the automated safety contract, return the relevant implementation ticket to in-progress before rollout (ticket guardrail).

Common setup to record per session: operator, date, app build/commit, backend environment, `DYNAMIC_COMMAND_PUBLISH_ENABLED` state in that environment, workbook id + published version id.

| # | Scenario | Host | Device(s) (model / firmware / serial) | Workbook version | Steps | Expected | Observed | Pass |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Canonical chain, one device | web |  |  | Run protocol → macro emits `{ toDevice }` → run ref command | Device receives the computed string; reply shown as command output |  | ☐ |
| 2 | Canonical chain, one device | mobile |  |  | Same flow inside a measurement cycle | Same as #1 |  | ☐ |
| 3 | Two devices, differing strings | web |  |  | Two connected MultispeQs; macro computes per-device values | Each device receives ONLY its own string (verify on-device) |  | ☐ |
| 4 | Two devices, differing strings | mobile |  |  | Same via multi-scanner | Same as #3 |  | ☐ |
| 5 | Shared question answer | either |  |  | Question `answer` referenced by command, two devices | Both devices receive the identical answer string |  | ☐ |
| 6 | Command-reply chaining | either |  |  | Second ref command reading the first command's reply field | Second command dispatches a value derived from the real device reply |  | ☐ |
| 7 | Reconnect identity change | mobile |  |  | Run source, power-cycle/reconnect device, run command | Command pre-fails for the reconnected device until the source reruns; no cross-device value |  | ☐ |
| 8 | One-device source failure | either |  |  | Force one device's source to fail (e.g. disconnect mid-scan) | Failed device pre-fails; the other device still executes its own value |  | ☐ |
| 9 | Mobile restart resume | mobile |  |  | Kill app mid-cycle after source ran; relaunch offline; run command | Cycle resumes; command resolves from the persisted output |  | ☐ |
| 10 | Workbook version change | either |  |  | Publish a new version mid-cycle; reload | Cycle restarts; no prior-version value dispatchable |  | ☐ |
| 11 | Old-client refusal | mobile (old build) |  |  | Fetch a dynamic version with a pre-capability build | Update-required outcome; no workbook payload parsed |  | ☐ |

Deviations/approvals log (any deviation from expected must name the approving human and the follow-up ticket):

| Date | Scenario # | Deviation | Approved by | Follow-up |
| --- | --- | --- | --- | --- |

## 6. Post-Ticket-6 UI polish pass (Phase 2)

Polish-only pass over the dynamic-command web surfaces after Ticket 6 closed; no behavior, contract, route, gate, ARIA-semantics, parser, or lifecycle changes.

- `linked-workbook-card.tsx`: the upgrade banner ("vN is available" / "Workbook has updates available" / "(currently on vN)") and the "Upgraded to vN" success strip were the last hard-coded English on these surfaces; moved to i18n keys `experiments:flow.upgradeBanner.*` with en-US + de-DE parity (nl-NL intentionally omitted, matching the Ticket 6 locale set; it falls back to en-US). Added `rel="noopener noreferrer"` to the `target="_blank"` workbook link.
- `command-cell.tsx`: localized the static format-select `aria-label` (`workbook:cells.commandFormatAria`) and gave the icon-only copy button an accessible name (`workbook:cells.commandCopyAria`), en-US + de-DE.
- `structural-issue-list.tsx`: `rel="noopener noreferrer"` on the open-workbook repair link. `role="alert"`/`aria-atomic` semantics untouched.
- `empty-workbook-state.tsx`, `new-experiment.tsx`, `workbook-upgrade-dialog.tsx`: reviewed; already consistent (design-system components, translated copy, correct empty/loading/error states) — no changes.
- Dark mode: not applicable on web (no theme provider; app renders light-only).
- Tests updated only where the literal-English assertions matched the now-localized strings (the web test harness renders i18n keys): `linked-workbook-card.test.tsx` banner assertions and `command-cell.test.tsx` format-label queries now assert the keys.
- No Phase 1 qualification checks had been deferred onto these files; nothing to re-run beyond the affected suites.

Phase 2 verification: affected suites (`components/experiment-flow`, `command-cell.test.tsx`, `components/workbook/upgrade`, `components/new-experiment`, `workbook-draft-editor.test.tsx`) — **15 files, 137/137 passed**; `turbo run check-types --force` — **4/4**; locale JSON validated for en-US/de-DE experiments + workbook. Full web suite reruns show an unrelated pre-existing flake in `components/experiment-dashboards/widgets/*` (a different widget test renders an empty body only under full-suite parallel load; the whole dashboards directory passes in isolation, 68 files / 331 tests, and those tests share nothing with the edited files).

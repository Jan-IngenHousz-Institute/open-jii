---
title: "Review: Ticket 7 qualification evidence + UI polish"
kind: review
---

# Review: Ticket 7 cross-host device qualification

Cold review of the qualifier agent's output: four new qualification fixtures, the evidence artifact, and a small web UI polish pass. Did not edit app files or artifact statuses.

## Verdict: ACCEPT (automated evidence + polish)

The four fixtures exercise the ticket's Included matrix and assert the acceptance criteria **non-vacuously** — every safety invariant is checked by at least one layer that would fail if the invariant broke, and the shared layer (the airtight one) asserts transport-never-called on every invalid case and forbids value leakage with exact `toEqual`. The evidence artifact matches the code, honestly records deviations, and the MultispeQ section is a genuine PENDING template (nothing fabricated). The UI polish is behavior-neutral with correct locale parity. Nothing else in the worktree was disturbed and all three rollout switches remain off.

The only open item is the **real-hardware MultispeQ matrix, correctly tracked as PENDING** — the ticket treats it as a separate human-operator gate before rollout, so it does not block acceptance of the automated deliverable, but Ticket 7 is not fully "done" until that runs.

## Fixture audit (assertions verified real, not vacuous)

| Layer | File | Result |
| --- | --- | --- |
| Shared `packages/api` | `dynamic-command-qualification.spec.ts` (15) | **Strongest.** Real `resolveCommandPayload` + real `cellsToFlowGraph`/`flowNodesToWorkbookCells` round trip. Exact transport call-lists (`toEqual([[A,…],[B,…]]`), reply-chaining proven (command-2 reads command-1's recorded reply), and **every** invalid case (`COMMAND_OUTPUT_MISSING`, `COMMAND_SOURCE_NOT_EARLIER`, field missing/empty/non-string, `COMMAND_SOURCE_STALE` ×2, `SOURCE_DEVICE_FAILED`, `DEVICE_OUTPUT_MISSING`) asserts `transport` **not** called. Telemetry test uses `toEqual` on the whole failure object → any leaked `data` field fails. Ran locally: 15/15. |
| Mobile `apps/mobile` | `mobile-dynamic-command-qualification.test.ts` (12) | Real persisted Zustand stores + `resolveMobileCommand` + rehydration guard + v1→v2 migration; exact values, no mocked-away invariant. Ran locally: 12/12. Two strengthen-only notes below. |
| Web `apps/web` | `useWorkbookExecution.dynamic-qualification.test.ts` (4) | Real hook: registry, epoch, resolver all real; only macro-server/transport/connections are doubles. Exact `toEqual` per-device, cross-device isolation pinned, workbook-change asserts zero transport. Ran locally: 4/4. |
| Backend `apps/backend` | `dynamic-command-qualification.spec.ts` (5) | Real DB + HTTP, real controller/use-case/capability header. 426 test inspects the actual body for absence of `cells`/`toDevice`/`sourceCellId`; capable-client served intact; static regression guard; refusal-log allowlist all non-vacuous. Needs the test DB (not run here; audited by reading). One note below. |

### Minor, non-blocking (test-strengthening, not correctness)

1. **Mobile retry/new-iteration (inv. 5):** asserts the epoch is re-minted and resolution fails, but calls the resolver directly (no transport spy), so "fails *before* transport" is not asserted at the mobile layer, and the failure is `COMMAND_OUTPUT_MISSING` (outputs wiped) rather than exercising the `COMMAND_SOURCE_STALE` epoch-mismatch guard. Mitigated: the shared spec covers stale-epoch **with `transport` asserted not-called**.
2. **Mobile telemetry (inv. 10):** the `not.toContain(secret)` probe is near-vacuous — the secret lives on `DEVICE_A` but the inspected failure is `DEVICE_OUTPUT_MISSING` for `DEVICE_B`, so the secret was never in scope. The load-bearing assertion (exact key allowlist, forbidding any data field) is strong, and the shared/backend/web telemetry checks are non-vacuous, so the invariant holds. Consider triggering the failure on the device that holds the secret.
3. **Backend publish-gate (inv. 1):** default-off is forced the *right* way (asserts `DYNAMIC_COMMAND_PUBLISH_ENABLED` is `undefined`, does not set `"true"`) and asserts the refusal code, but the "version is not created" half is only *inferred* from the failure `Result` — no DB/repo query for row absence. Mitigated: the Ticket-2 unit spec proves `repository.create` is not called on failure (tech plan §2).
4. **Web telemetry (inv. 3):** the leak check covers `console.warn` but not the durable `posthog.capture` payload; both share the same `resolutionFailurePayload` object, so it is transitively covered.

None of these leave an invariant covered *only* vacuously — each is asserted non-vacuously in at least one layer.

## Evidence artifact

- Claims match code. Full-gate deviations are honest and match known environment caveats (`turbo run check-types` vs the missing `typecheck` task; `data#test` `JAVA_HOME` under turbo strict env with the suite passing standalone; flaky results at concurrency 20 → recorded at 4).
- **Readiness checklist correct:** `DYNAMIC_COMMAND_AUTHORING` → `false` in the analytics fallback map; `DYNAMIC_COMMAND_PUBLISH_ENABLED` gated `!== "true"` (default off); no CMS/force-update files in the worktree. All three switches confirmed off.
- **MultispeQ §5 is an honest template** — explicitly states "Nothing below is filled in; do not treat as executed evidence." Not fabricated.

## UI polish (behavior-neutral, verified)

- `linked-workbook-card.tsx`: upgrade-banner strings → `experiments:flow.upgradeBanner.{newVersion,updatesAvailable,currentVersion,upgraded}` (en-US + de-DE parity); `rel="noopener noreferrer"` on the `target="_blank"` link. Rendered text unchanged.
- `command-cell.tsx`: two static-cell aria labels localized (`workbook:cells.commandFormatAria`, `commandCopyAria`), en-US + de-DE.
- `structural-issue-list.tsx`: `rel="noopener noreferrer"` added; `role="alert"`/`aria-atomic="true"` untouched.
- Locale parity confirmed for all six new keys; nl-NL intentionally omitted (matches the Ticket 6 locale set → falls back to en-US). Test updates are localized-key assertion swaps; `linked-workbook-card.flicker.test.tsx` adds `reset: vi.fn()` to a mock (needed by Ticket 6 code, behavior-neutral). Ran the three affected suites: 54/54.

*Scope note:* these files also carry the full Ticket 6 authoring UI in the same uncommitted worktree; I verified the **described** polish is present, behavior-neutral, and locale-correct, but could not git-isolate the polish edits from Ticket 6 content (nothing is committed). No contract/route/gate/alert-semantics change is present in the described polish.

## Nothing else disturbed

Working-tree scan shows no config/deploy/monitoring/CMS/CI/lockfile/`package.json`/`.env` changes. The only backend/analytics files present (`publish-version.ts`/`.spec.ts`, `feature-flags.ts`) are Ticket 1/2 work already in the worktree, both default-off. No flag flips, no commits/reverts.

## Checks run

Node 22 sandbox (repo targets Node 24; ran what is runtime-independent). Shared qualification spec 15/15, web qualification 4/4, mobile qualification 12/12, polish suites 54/54, `@repo/api` `tsc --noEmit` clean. Not run: the full per-package suites and the backend spec (needs the port-5433 test DB) — the evidence artifact's full-gate numbers were not independently reproduced; the new specs I could run all pass, and the four fixtures were audited assertion-by-assertion.

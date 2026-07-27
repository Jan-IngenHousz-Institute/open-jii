---
title: "Review — ticket 6 web dynamic authoring"
kind: review
---

# Review: web dynamic-command authoring (ticket 6)

**Verdict: REJECT.** Ticket 6 is not safe to complete. The default-off rollout boundary and most authoring mechanics are sound, but three acceptance-level paths remain broken: selecting a question does not author `field: "answer"`, flag-off owners can delete a ref cell, and sanitized backend structural failures are discarded instead of mapped to the relevant command. The new UI also bypasses the required translation layer.

No artifact comment threads were open when this review began.

## Findings

### 1. Major Drift — choosing a question does not persist its only legal field (high)

**Evidence:** `apps/web/components/workbook/cells/command-cell.tsx:275-306`; `command-cell.test.tsx:252-269`.

The source select updates only `sourceCellId` (`onValueChange={(v) => updateRef({ sourceCellId: v })}`). Once the selected source is a question, the free field input is hidden and the UI says it uses `answer`, but the payload's field remains whatever it was before: `""` for a newly-created ref or a stale non-question field such as `toDevice`. The former cannot be repaired through the UI and remains structurally invalid; the latter can publish but fails at runtime because a question exposes only `answer`.

The test starts from an already-correct question ref and therefore never exercises source selection.

**Fix:** resolve the selected source in the change handler and atomically write `{ sourceCellId: v, field: source.type === "question" ? "answer" : nextField }`. Define the non-question transition explicitly rather than retaining a hidden question-only field by accident. Add interaction tests that select a question from (a) the initial empty ref and (b) a ref with a non-question field, then assert the exact emitted payload.

### 2. Major Drift — flag-off ref cells retain a structural delete control (high)

**Evidence:** `apps/web/components/workbook/cells/command-cell.tsx:209-226`; `apps/web/components/workbook/cell-wrapper.tsx:182-198,227-238`; `command-cell.test.tsx:145-165`.

The flag-off branch hides the mode/source/field controls, but `commonWrapper` still passes `onDelete` while leaving `readOnly` false for the workbook owner. `CellWrapper` consequently renders both Delete and Run. Run is required, but Delete is ref authoring: the owner can mutate/remove an existing ref while the authoring flag is unavailable or false. The existing flag-off test checks only that no format/text control exists and never checks structural actions.

**Fix:** separate authoring lock from runtime/read-only state. For a ref with authoring disabled, omit/disable `onDelete` while preserving `onRun` (and, if intended, collapse). Do not use `readOnly={true}` as the shortcut because `CellWrapper` also hides Run. Test explicit `undefined` and `false` flag states: Delete absent/inert, Run present and callable, exact ref payload unchanged.

### 3. Major Drift — raw backend structural publication failures are discarded (high)

**Evidence:** `apps/web/components/experiment-flow/linked-workbook-card.tsx:147-159,192-205`; `apps/web/components/workbook/upgrade/workbook-upgrade-dialog.tsx:51-68`; `apps/web/util/apiError.ts:4-37`; `workbook-upgrade-dialog.test.tsx:147-177`; `linked-workbook-card.test.tsx:220-239,361-383`.

The backend intentionally returns a production-safe `WORKBOOK_STRUCTURAL_VALIDATION_FAILED` payload with allowlisted `details.issues`. The upgrade and attach handlers ignore the error object and show only `flow.upgradeFailed` / `flow.attachFailed`. `parseApiError` strips details even if a caller were to use it. The new dialog test described as structured dynamic-command guidance constructs a broken live workbook and exercises the local `validateWorkbook` path; it never mounts a backend error response with `details.issues`.

This misses the ticket's explicit raw-backend path: a race, alternate attach path, or structural condition detected only by the server cannot be mapped back to its command cell or repaired from the publication UI.

**Fix:** add a strict client parser for the server's allowlisted structural detail shape, accept the mutation error in attach/upgrade `onError`, keep the review context open, and render translated issue guidance keyed by `commandCellId` (with source/field identifiers where present). Unknown/malformed details must fall back to the generic error without rendering raw data. Add an HTTP/oRPC-shaped test containing `code: WORKBOOK_STRUCTURAL_VALIDATION_FAILED` and sanitized `details.issues`; assert cell-level guidance, dialog remains open, and sentinel extra fields are absent.

### 4. Product Misalignment — all new authoring and repair copy is inline English (medium)

**Evidence:** `apps/web/components/workbook/cells/command-cell.tsx:154-182,232-241,275-316`; `apps/web/lib/workbook/dynamic-command-authoring.ts:32-46,94-107`; no Ticket-6 changes under `packages/i18n/locales/{en-US,nl-NL,de-DE}`.

Mode labels, tooltip, read-only summary, source/field labels and placeholders, unavailable state, question shared-scope note, source fallback labels, and every structural repair instruction bypass i18n. The issue helper exports final English prose, which then leaks into the experiments upgrade dialog. This conflicts with the ticket's named translations/accessibility surface and produces mixed-language authoring and publication UI.

**Fix:** represent source fallbacks and issue guidance as translation keys (or translate at the component boundary), add the keys to all supported workbook/experiments locale files, and localize visible text plus ARIA labels. Add locale/key tests for the authoring and structural-error states.

## What is well implemented

- The analytics flag is declared and defaults false (`packages/analytics/src/feature-flags.ts:13,30`); the component also treats the analytics hook's `undefined` as false and combines it with owner/read-only gating (`command-cell.tsx:88-92`).
- Static/ref switching replaces the full payload variant with no hidden fallback (`command-cell.tsx:132-152`). Static string/JSON/YAML editing remains unchanged while the flag is off.
- Earlier-source filtering uses authored non-output order and the correct protocol/command/macro/question eligibility set (`dynamic-command-authoring.ts:16-22,54-64`). Manual top-level fields and visible-output suggestions are implemented; no dynamic JSON/YAML, nested-path, or template editor is shown.
- Broken/deleted/reordered source ids remain in the payload and are rendered as unavailable for repair (`command-cell.tsx:254-299`). Resolved previews are passed as runtime state rather than persisted payload.
- Sidebar and derived flow-node labels are deterministic and do not dereference static content (`workbook-sidebar.tsx:82-95`; `packages/api/src/transforms/cells-to-flow.ts:10-21,80-87`).
- Ticket 6 did not enable the backend `DYNAMIC_COMMAND_PUBLISH_ENABLED` boundary or alter the CMS force-update gate. Backend publication remains default-off unless the environment variable is exactly `"true"`.

## Missing or overstated coverage

- `command-cell.test.tsx:252-269` verifies display of an already-correct question ref, not the source-picker transition that is broken.
- `command-cell.test.tsx:145-165` describes the flag-off ref as read-only but does not assert Delete is unavailable or Run remains available.
- `workbook-upgrade-dialog.test.tsx:147-177` is a local-validator test, not the required structured backend-issue test.
- Sidebar label coverage exists, and the API converter asserts the derived node name, but no web FlowMapper/canvas test loads a ref command and proves the rendered read-only node label/payload survives. This is a coverage gap rather than a demonstrated runtime defect.

## Verification

- Focused Ticket-6/publish surfaces: **5 files / 68 tests passed** (`command-cell`, authoring helpers, upgrade dialog, sidebar, linked workbook card).
- Broad web suite: **668 files / 4,820 tests passed, 2 skipped; 2 failures**. Both failures are in untouched dashboard visualization tests (`widget-editor.test.tsx`, `widget-renderer.test.tsx`) and are unrelated to Ticket 6.
- `pnpm --filter web check-types`: passed.
- `pnpm --filter web lint`: passed.
- `pnpm --filter @repo/analytics typecheck && ... lint`: passed (the package has no test script).
- `pnpm --filter @repo/api typecheck && ... lint`: passed.
- `git diff --check -- apps/web packages/analytics packages/api packages/i18n`: passed.
- Environment note: commands emitted the repository engine warning because the runner is Node 22 while the workspace requests Node 24; no checked command failed for that reason.

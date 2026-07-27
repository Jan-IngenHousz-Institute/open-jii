---
title: "Review — ticket 6 authoring safety and publication errors amendment"
kind: review
---

# Third re-review: authoring safety and publication errors amendment

**Verdict: ACCEPT.** No blocking correctness, safety, accessibility, or product-alignment findings remain. Amendment 01 and parent Ticket 6 are safe to complete; downstream qualification may proceed subject to its normal dependency status.

No comment threads were open on the amendment or review when this pass began.

## Final closure

- **New-experiment durable repair state:** structural rejection stores `{ experimentId, workbookId, issues }` in component state and returns a dedicated creation-result panel (`apps/web/components/new-experiment/new-experiment.tsx:49-56,121-130,204-230`). The panel preserves every projected `commandCellId`, links to the exact attempted workbook under the active locale, and separately links to the created unattached experiment. It does not navigate or emit attached-success on the structural path; generic failure remains a truthful destructive toast followed by navigation to the genuinely created/unattached experiment.
- **Navigation guard:** submission sets `isSubmitting` before creation and it remains true in the result state, so the unsaved-change effect exits (`new-experiment.tsx:143-158`). The two explicit result links are not intercepted or trapped. All hooks run before the conditional result return, so hook order is stable.
- **Real-envelope/non-leak test:** `new-experiment.test.tsx:116-158` drives a real MSW 400 oRPC body containing two command ids plus top-level/per-issue sentinels. It asserts the atomic alert, both ids, exact locale-aware workbook and experiment routes, no sentinel, no success toast, and no `router.push`.
- **Accessible asynchronous errors:** the shared attach issue region is `role="alert"` and `aria-atomic="true"`, with its decorative icon hidden and translated repair-link name (`structural-issue-list.tsx:33-61`). The upgrade server-rejection section has the same alert/atomic boundary and hides its icon (`workbook-upgrade-dialog.tsx:227-244`). Attach and upgrade tests assert the alert semantics and accessible links.
- **All selected-existing attach entry points:** linked card, empty state, and new experiment parse the real structural envelope, retain the attempted target identity, expose command-level repair context without raw extras, and keep nonstructural errors generic. Linked-card/empty-state picker state remains usable for repair; new experiment intentionally uses the durable result panel.
- **Upgrade lifecycle:** the stable mutation reset runs on mount/target change and before a fresh review, never on active error state. The live integration test proves rejection remains visible, close/reopen clears only the stale rejection, and a second mutation succeeds without an effect loop or wrong-target state.
- **Parser hardening:** only own non-accessor fields on plain objects are read; inherited/class/null-prototype/array carriers are rejected; getters/proxies cannot throw through; unknown/malformed codes become generic; optional `sourceCellId` is handled without invention. Direct, real `ORPCError`, hostile-object, mixed-sibling, and sentinel tests remain green.
- **Authoring safety:** actual Radix tests prove empty ref → question writes `field: "answer"` atomically and question → non-question clears it. Helper tests cover stale non-question → question. False/undefined authoring flags retain Run/collapse and exact refs while hiding edit/convert/delete.
- **i18n and issue completeness:** source fallback/type suffix, question/shared note, tooltip, placeholders, ARIA labels, attach/upgrade/result copy, and all seven structural codes are keyed for the configured `en-US`/`de-DE` locales. `NODE_UNREACHABLE` correctly identifies the command as unreachable from flow start. No raw enum/English regression was found.
- **Rollout boundaries:** analytics authoring remains default-off; backend publication remains exact-true/default-off; CMS force-update files are untouched.
- **FlowMapper:** the noted test deviation remains non-blocking. The live graph surface is read-only, and mapper/converter preserve the ref carrier and deterministic label without mutation/drop.

## Verification

- Focused authoring/parser/attach/upgrade/FlowMapper suite: **11 files / 151 tests passed**.
- Broad web suite: **670 files / 4,865 tests passed, 2 skipped; 2 failures**. The only failures are the same untouched dashboard visualization tests (`widget-editor.test.tsx`, `widget-renderer.test.tsx`) and remain unrelated to Ticket 6.
- `pnpm --filter web check-types`: passed.
- `pnpm --filter web lint`: passed.
- `pnpm --filter @repo/i18n typecheck && ... lint`: passed.
- `pnpm --filter @repo/analytics typecheck && ... lint`: passed (no analytics test script).
- `pnpm --filter @repo/api typecheck && ... lint`: passed.
- `git diff --check -- apps/web packages/i18n packages/analytics packages/api`: passed.
- Concurrent Ticket 7-only untracked fixtures were excluded from review findings as requested.
- Environment note: Node 22 emitted the repository's Node 24 engine warning but caused no checked-command failure.

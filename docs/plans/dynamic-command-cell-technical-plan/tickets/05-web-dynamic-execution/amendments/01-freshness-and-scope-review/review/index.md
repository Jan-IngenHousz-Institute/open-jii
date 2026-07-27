---
title: "Review — ticket 5 freshness and scope amendment"
kind: review
---

# Seventh re-review: ticket 5 freshness and scope amendment

**Verdict: ACCEPT.** No blocking correctness, safety, or product-alignment findings remain. Amendment 01 and Ticket 5 are safe to complete; Ticket 6 may begin when its dependency/status rules allow.

No artifact comment threads were open when this review began.

## Final closure

- The workbook-key transition is atomic in one layout effect (`apps/web/hooks/workbook/useWorkbookExecution/useWorkbookExecution.ts:465-478`): it invalidates generation/epoch/registry/runtime UI first, then publishes the committed workbook key and synchronizes design-key/signature refs without yielding. External handlers cannot observe the transient ordering inside one callback.
- The passive effect now handles authored-signature replacement only (`:480-493`); it has no workbook-key branch, sees the signature synchronized by the layout transition, and neither double-invalidates nor loops.
- Old tokens and queued transforms become inert at the layout boundary. A new execution started by a later layout effect captures the new key, new epoch, and new generation. `commitStep` rechecks the full token when the host actually applies its transform (`:1194-1206`).
- `useWorkbookExecution.layout.test.tsx:63-158` genuinely exercises the flagged window: the hook registers its layout effect before the harness layout effect in the same component. The new-key source starts after atomic transition but before passive effects, remains resolver-eligible afterward, and a pre-transition queued transform is a no-op. The prior two-phase implementation would clear/strand the source result.
- Every manual and Run-all execution owns a distinct `RunContext` and consumed-target set threaded through nested/device branch dispatch. Concurrent runs cannot clear or observe each other's branch bookkeeping; routed targets remain once-only and exact-group.
- Captured run tokens, after-await checks, captured provenance stamps/resolver inputs, apply-time delta checks, macro predecessor freshness and device/shared scope, field-scoped delta composition, output replacement/collapse, reverse questions/two branches, Clear/no-resurrection, telemetry allowlist/production silence, static/ref behavior, ref immutability, and rollout controls remain closed.

## Verification

- Focused hook/layout-harness/draft-editor/editor/cell suite: **8 files, 190 tests passed**.
- `pnpm --filter web check-types`: **passed**.
- `git diff --check -- apps/web`: **passed**.
- Broad web suite: **668 files / 4,803 tests passed, 2 skipped**. One known dashboard visualization test failed in an untouched file (`widget-renderer.test.tsx`); it is unrelated to Ticket 5. The companion historical dashboard failure passed in this run, consistent with that area's existing flakiness.

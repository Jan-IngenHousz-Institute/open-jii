---
title: "Migrate mobile to the unified per-producer output registry"
kind: ticket
status: 2
---

# Migrate mobile to the unified per-producer output registry

## Outcome

Make mobile's persisted active cycle retain every protocol, command, and macro result per producer and device, with provenance that survives a valid restart/upgrade and fails closed across workbook versions.

## Governing context

- [Ticket overview](../index.md)
- [Technical plan](../../index.md), section 7
- [Core Flows](../../../dynamic-command-cell-core-flows/index.md), mobile freshness and resume
- Critique findings F3, F4, and F7

## Included

- Add persisted `outputsByCellId` as the resolver authority for protocol, command, and macro results.
- Update current producer write paths to record explicit shared/device scope, all device identities, workbook version, and active cycle epoch.
- Fold legacy `cellOutputs` and singular `scanResults`/`producerCellId` authority into the per-producer registry.
- Keep legacy scan fields only as derived upload/UI projections while existing consumers need them.
- Add the question-answer adapter through the single mobile `getRuntimeCellOutput` boundary.
- Make new iteration, retry, reset, abandonment, and different-version/experiment loads create a new epoch and clear outputs, answers, previews, and progress.
- Preserve state on same-version refetch.
- Implement `measurement-flow-storage` v1→v2 migration and `flow-answers-storage` v1→v2 identity migration.
- Add the coordinated post-hydration resume guard and safe reset message/metric.

## Explicitly out

- Resolving or dispatching dynamic command nodes.
- Changing upload payload semantics except where derived projections must continue to match existing behavior.
- Stable hardware identity across reconnects.

## Primary surfaces

- `apps/mobile/src/features/measurement-flow/domain/flow-transitions.ts`
- `apps/mobile/src/features/measurement-flow/stores/use-measurement-flow-store.ts`
- `apps/mobile/src/features/measurement-flow/stores/use-flow-answers-store.ts`
- `apps/mobile/src/features/measurement-flow/stores/flow-rehydration-guard.ts`
- Producer completion paths in measurement capture and macro/command processing
- `use-load-experiment-flow.ts` version-change coordination

## Dependencies

Ticket 2.

## Acceptance criteria

- Running a later producer does not erase an earlier producer's device split.
- Protocol/command output is device-scoped even when one device ran.
- Shared and per-device macro results retain their true execution scope.
- Question `answer` is exposed as a shared current-cycle value.
- Same-version refetch preserves the active cycle; different-version or experiment load clears both stores before execution.
- Restart/background preserves a valid active epoch and registry.
- V1 macro state and attributed scans migrate with valid provenance; unattributed scans remain visible if needed but are not dynamically resolvable.
- V1 answers survive the coordinated identity migration.
- Malformed or inconsistent cross-store state resets both stores and cannot become fresh.
- Existing static flow resume, branch evaluation, upload, and answer behavior remains green.

## Verification

- Use real serialized v1 fixtures for macro, attributed scan, unattributed scan, branch-progress, and answer cases.
- Add lifecycle tests for retry/reset/abandon/new iteration, same-version refetch, workbook change, and experiment switch.
- Run focused mobile store, persistence, rehydration, transition, load-flow, measurement, macro, upload, and branch tests.
- Run `pnpm --filter mobile typecheck` and `pnpm --filter mobile test`.

## Guardrails

- Never infer device scope from display `scanResult`.
- Migration may preserve valid work, but ambiguity must reset or remain non-resolvable.
- Do not persist two independent sources of truth for producer outputs.
- Normalize existing scan/output records into a new `RuntimeCellOutput`; never forward raw output cells or device results containing display-only `family`, `deviceName`, `executionTime`, `messages`, or top-level primary data into the strict resolver envelope.

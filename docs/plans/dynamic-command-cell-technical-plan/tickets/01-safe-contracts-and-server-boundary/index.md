---
title: "Establish safe dynamic-command contracts and the server boundary"
kind: ticket
status: 2
---

# Establish safe dynamic-command contracts and the server boundary

## Outcome

Introduce the reference payload and flow carrier in a dormant, backward-safe state. A ref can be saved and round-tripped by updated code, but it cannot be published before the release gate opens or returned to a client that lacks the declared capability.

## Governing context

- [Ticket overview](../index.md)
- [Technical plan](../../index.md), sections 1, 2, and 8
- [Core Flows](../../../dynamic-command-cell-core-flows/index.md), validation and compatibility
- Critique findings F1, F2, and F5

## Included

- Create the neutral strict static/ref command-source schemas and preserve the existing static payload shape without requiring `kind`.
- Extend workbook cells and experiment measurement-command content with the explicit ref carrier.
- Update `cellsToFlowGraph` and `flowNodesToWorkbookCells` so ref nodes keep their id, order, label, source, field, and edges.
- Add shared dynamic-ref detection and structural validation with stable issue codes and actionable context.
- Aggregate the new issues in web `validateWorkbook`.
- Enforce structural validation and the default-off `DYNAMIC_COMMAND_PUBLISH_ENABLED` gate in `PublishVersionUseCase` before snapshots or repository creation.
- Define `dynamic-command-ref-v1` and send it from updated web/mobile API clients in `x-openjii-capabilities` without changing workbook-version query keys.
- Refuse a dynamic workbook version when the capability is missing, using `DYNAMIC_COMMAND_CLIENT_UPGRADE_REQUIRED` and HTTP 426; extend the backend/oRPC error mapping accordingly.
- Add safe logs/metrics for validation, publish-gate, and capability refusals without logging payload data.

## Explicitly out

- Runtime output envelopes and reference resolution.
- Web/mobile execution state and UI.
- Enabling the backend switch, web authoring flag, or CMS gate.
- Database migration; workbook/version cells remain JSON.

## Primary surfaces

- `packages/api/src/domains/workbook/workbook-cells.schema.ts`
- `packages/api/src/domains/experiment/experiment.schema.ts`
- `packages/api/src/transforms/cells-to-flow.ts`
- `packages/api/src/transforms/flow-to-workbook-cells.ts`
- `packages/api/src/transforms/validate-workbook.ts` and new neutral helpers
- `apps/backend/src/workbooks/application/use-cases/publish-version/publish-version.ts`
- `apps/backend/src/workbooks/application/use-cases/get-workbook-version/get-workbook-version.ts`
- Backend oRPC error mapping and web/mobile oRPC client headers

## Dependencies

None.

## Acceptance criteria

- Existing static command JSON parses unchanged and static string/JSON/YAML conversion tests remain green.
- A strict ref cell parses; mixed static/ref shapes are rejected.
- Cells → flow → cells and flow → cells → flow retain one dynamic command node with the original reference and edges.
- No converter reads absent `content` or silently drops/retypes a ref node.
- Draft parsing tolerates deleted/reordered cross-cell refs, while the structural validator reports stable issues.
- All publish entry points reject structural issues with `{ issues }` details and do not call version creation.
- The default-off publish gate blocks only workbooks containing a ref.
- A static version is fetchable without the capability; a dynamic version is returned only with it.
- A missing-capability response is HTTP 426 and contains no workbook cells.
- Updated-client headers do not alter the persisted offline query-cache key.

## Verification

- Run focused API schema, converter, validator, and contract tests.
- Run backend publish/get-version/controller tests, including direct API paths and repository non-invocation.
- Run the web/mobile API-client header tests.
- Run `pnpm --filter @repo/api typecheck`, `pnpm --filter backend build`, and the affected package tests.

## Guardrails

- Keep publication disabled after the ticket.
- Do not encode refs inside legacy `content` or add a fake static fallback.
- Capability refusal must occur before the response is parsed against an old workbook schema.

## Completion evidence

- Completed after eight adversarial amendment passes and independent closure review.
- Standalone and route flow schemas, public flow CRUD, workbook publication, version/flow capability refusal, strict materialization, atomic pointer/flow binding, empty/no-flow behavior, and production-safe errors are covered.
- User approved a breaking strict-read boundary for malformed historical flow rows; those rows return a stable payload-free incompatibility error and receive no migration/backfill.
- Final review reran 1,391 API tests and the full backend command with 2,298 test executions, plus focused web/mobile checks, builds, and `git diff --check`.
- Backend dynamic publication, web authoring, and CMS rollout controls remain disabled.

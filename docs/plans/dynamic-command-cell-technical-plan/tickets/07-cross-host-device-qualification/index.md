---
title: "Qualify the cross-host dynamic command flow and real device"
kind: ticket
status: 1
---

# Qualify the cross-host dynamic command flow and real device

## Outcome

Produce automated and real-MultispeQ evidence that the complete Python output → dynamic command → device reply flow satisfies freshness, per-device safety, compatibility, and resume invariants on web and mobile.

## Governing context

- [Ticket overview](../index.md)
- [Technical plan](../../index.md), verification strategy
- [Core Flows](../../../dynamic-command-cell-core-flows/index.md), success criteria
- Depends on [ticket 4](../04-mobile-dynamic-execution/index.md) and [ticket 6](../06-web-dynamic-authoring/index.md)

## Included

- Add/complete cross-package integration fixtures for protocol → Python macro `{ toDevice }` → ref command → command reply.
- Exercise one-device, two-device differing strings, shared question answer, and command-output chaining on web and mobile.
- Exercise branch skip, visually later goto source, loop refresh, missing/empty/non-string field, stale epoch, prior workbook version, one-device source failure, reconnect id change, retry, restart, valid v1 migration, malformed migration, and version change.
- Verify direct API publish validation, default-off publication, capability refusal, and unchanged static version fetch.
- Verify no resolution failure reaches device transport and no sensitive command/source value reaches logs.
- Run the affected repository checks and record results.
- Execute the agreed real MultispeQ calibration matrix on both hosts and record device/host outcomes and any approved deviations.
- Produce a concise readiness checklist for later rollout operators without changing deployment or monitoring configuration.

## Explicitly out

- Enabling the backend publication switch, authoring flag, or CMS minimum version.
- Shipping a mobile release or performing production deployment.
- Adding unrelated end-to-end infrastructure.

## Primary surfaces

- Existing API/backend/web/mobile Vitest integration suites and factories
- Mobile offline/persistence fixtures
- Web/mobile device assignment test doubles
- Manual MultispeQ verification record attached to this ticket

## Dependencies

Tickets 4 and 6.

## Acceptance criteria

- Both hosts complete the canonical Python-output flow and retain the command reply as a later source.
- Two devices receive only their own computed strings.
- Shared question `answer` intentionally reaches both devices unchanged.
- Every stale, ambiguous, cross-device, and unsupported-client case fails before transport.
- Valid mobile resume survives restart/upgrade; malformed or cross-version state resets.
- Static string/JSON/YAML, branch, offline cache, upload, and publish regressions are green.
- Logs contain ids/codes/provenance only, not resolved strings or raw source data.
- Real hardware results match the automated safety contract, or any discrepancy returns the relevant implementation ticket to in-progress before rollout.
- The readiness record explicitly confirms all three rollout switches remain off.

## Verification

- Run focused suites during iteration, then `pnpm typecheck`, `pnpm test`, and `pnpm build:affected` (or the repository-approved affected equivalents).
- Record exact automated commands and results in the ticket.
- Record MultispeQ model/identity behavior, host, workbook version, one/two-device assignments, reconnect behavior, and observed replies.

## Guardrails

- Qualification evidence is required; a checklist without executed results is not completion.
- Do not weaken exact-device or freshness behavior to make hardware tests pass.
- This ticket prepares rollout evidence but performs no rollout action.

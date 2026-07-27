---
title: "Qualify the cross-host loop flow, session record, and real device"
kind: ticket
status: 0
---

# Qualify the cross-host loop flow, session record, and real device

## Outcome

Automated and real-MultispeQ evidence that the complete loop flow — Expression → dynamic command → measurement per iteration, preview, upload, completeness, authoritative processing — satisfies the safety, resume, compatibility, and provenance invariants on both hosts.

## Governing context

- [Technical plan (rev 3)](../../index.md) verification strategy; [companion](../../loop-run-provenance-and-completeness/index.md)
- Epic precedent: dynamic-command ticket 07 (qualification evidence discipline)

## Included

- Cross-package fixtures for the canonical light-X/Y/Z run on web and mobile: one/two devices, Expression-computed bounds, sparse leaves, reconnect mid-loop, restart/resume mid-loop, version change, stale epoch inside iterations, old-client refusal (426 + rehydration guard + web guard), flag-off locks.
- End-to-end session trail: mobile run → leaves + marker → ingestion → completeness (complete, partial-then-supersede, no-marker long-stop simulated) → `session_results`; conformance fixture cross-site results identical.
- Log-safety sweep: no loop values, leaf data, or resolved commands in any log/telemetry.
- Run affected repository checks; record exact commands/results; readiness checklist confirming every loop rollout switch remains off.
- Real MultispeQ loop matrix template (hosts × device counts × reconnect × resume × observed replies) — execution requires a human with hardware; recorded as PENDING, never fabricated.

## Explicitly out

- Enabling any switch; deployment/monitoring changes; shipping releases.

## Dependencies

Tickets 05, 06, 08, 10.

## Acceptance criteria

- Every plan invariant has an executed, recorded automated check (a checklist without executed results is not completion).
- Hardware matrix executed by a human matches the automated contract, or the discrepancy reopens the relevant ticket before rollout.
- Readiness record explicitly confirms all loop switches off.

## Guardrails

Never weaken invariants to make qualification pass; evidence over assertion. Leave statuses to the coordinator.

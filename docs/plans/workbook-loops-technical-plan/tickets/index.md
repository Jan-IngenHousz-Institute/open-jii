---
title: "Workbook loops — implementation tickets"
kind: story
status: 0
---

# Workbook loops — implementation tickets

Breakdown of the [technical plan (rev 3)](../index.md) and the [session provenance & streaming completeness companion](../loop-run-provenance-and-completeness/index.md), following the dynamic-command epic's ticket discipline: every ticket ships dark, leaves the tree green, and passes independent review before closing. Rollout switches: `WORKBOOK_LOOPS` authoring flag (default-off), publish gate refuses loop graphs unless enabled, CMS minimum untouched.

```mermaid
flowchart TB
  T01[01 Loop contracts &<br/>serialization safety] --> T02[02 Expression / Processing-step<br/>role reclassification]
  T01 --> T04[04 Shared loop semantics<br/>+ leaf identity]
  T03[03 Fan-in run mode<br/>sandbox + hosts]
  T04 --> T05[05 Mobile loop execution<br/>& resume]
  T02 --> T05
  T03 --> T05
  T01 --> T07[07 Web loop authoring]
  T02 --> T07
  T04 --> T08[08 Web loop execution]
  T03 --> T08
  T07 --> T08
  T05 --> T06[06 Mobile session provenance<br/>& completion marker]
  T06 --> T09[09 Ingestion: session columns<br/>+ control routing]
  T09 --> T10[10 Streaming completeness +<br/>session processing service]
  T03 --> T10
  T05 --> T11[11 Cross-host loop<br/>qualification]
  T06 --> T11
  T08 --> T11
  T10 --> T11
  style T01 fill:#0d47a1,color:#fff
  style T04 fill:#0d47a1,color:#fff
  style T10 fill:#4a148c,color:#fff
  style T11 fill:#1b5e20,color:#fff
```

| # | Ticket | Layer |
| --- | --- | --- |
| 01 | [Loop contracts & serialization safety](01-loop-contracts-and-serialization/index.md) | packages/api + backend |
| 02 | [Expression / Processing-step role reclassification](02-expression-processing-roles/index.md) | cross-cutting rename/migration |
| 03 | [Fan-in run mode](03-fan-in-run-mode/index.md) | macro-sandbox + mobile/web runners |
| 04 | [Shared loop semantics + leaf identity](04-shared-loop-semantics/index.md) | packages/api |
| 05 | [Mobile loop execution & resume](05-mobile-loop-execution/index.md) | apps/mobile |
| 06 | [Mobile session provenance & completion marker](06-mobile-session-provenance/index.md) | apps/mobile |
| 07 | [Web loop authoring](07-web-loop-authoring/index.md) | apps/web |
| 08 | [Web loop execution](08-web-loop-execution/index.md) | apps/web |
| 09 | [Ingestion: session columns + control routing](09-ingestion-session-tables/index.md) | apps/data (centrum) |
| 10 | [Streaming completeness + session processing service](10-streaming-completeness/index.md) | new streaming app + backend + data |
| 11 | [Cross-host loop qualification](11-cross-host-loop-qualification/index.md) | all |

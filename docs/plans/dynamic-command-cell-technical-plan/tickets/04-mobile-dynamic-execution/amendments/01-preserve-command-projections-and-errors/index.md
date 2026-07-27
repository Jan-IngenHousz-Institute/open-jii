---
title: "Preserve mobile command projections and branch errors"
kind: ticket
status: 2
---

# Preserve mobile command projections and branch errors

Parent: [Execute dynamic command cells safely on mobile](../../index.md)

Independent review accepted the dynamic resolver and dispatch path but identified a direct-command compatibility change. The governing technical plan settles this behavior: legacy scan fields remain derived upload/UI projections while `outputsByCellId` is the sole resolver authority, and existing static command, analysis, and upload behavior must remain green.

## Required fixes

- Restore the direct standalone command's derived `scanResult`/`scanResults` projection from completed per-device command outcomes so existing upload and following-analysis consumers retain their behavior.
- Keep reference resolution entirely on `outputsByCellId`; no legacy projection may become freshness or device-scope authority.
- Preserve multi-device identity in the projection and define partial-failure behavior consistently with existing upload/UI conventions.
- Attribute branch command transport failures to the exact target command producer and device in `outputsByCellId`, so a later ref fails as `SOURCE_DEVICE_FAILED` rather than losing the failure as `DEVICE_OUTPUT_MISSING`. Resolution pre-failures remain non-executions and must not be promoted into command output.

## Acceptance criteria

- A standalone static or dynamic command reply remains available to existing upload and immediate analysis consumers while also being recorded in the per-producer registry.
- Multi-device command projections retain exact device ids and do not change resolver authority.
- A branch command transport failure is retained under its command cell/device and blocks a later reference with the source-device failure code.
- Existing protocol/branch upload payload shapes remain unchanged.

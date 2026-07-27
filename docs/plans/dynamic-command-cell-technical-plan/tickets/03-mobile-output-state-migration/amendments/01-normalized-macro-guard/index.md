---
title: "Fix normalized macro-output convergence"
kind: ticket
status: 2
---

# Fix normalized macro-output convergence

Parent: [Migrate mobile to the unified per-producer output registry](../../index.md)

Independent review found one high regression: `AnalysisNode` compares raw macro output with normalized stored output. Display fields such as `messages` are stripped on write, so the comparison never converges and a multi-device render can write indefinitely.

## Required fix

- Normalize a macro result once before compare/write.
- Compare normalized candidate data with the normalized registry entry.
- Preserve raw macro messages for their existing display path; only the resolver envelope is normalized.
- Apply the same symmetric behavior to single-device and multi-device callbacks.
- Add a multi-device render regression test with a messages-bearing macro output. Assert the registry write converges, no maximum-depth loop occurs, every device result remains retained, and display messages still render through the existing UI path.

## Acceptance criteria

- A messages-bearing macro result produces at most one effective registry write per device/value.
- Re-rendering `AnalysisNode` cannot create an update loop.
- Strict resolver output still strips display-only fields.
- Existing single/multi-device macro display, upload, and registry tests remain green.

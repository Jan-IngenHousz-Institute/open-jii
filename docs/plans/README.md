# Planning artifacts

Point-in-time planning, review, and qualification records for major workbook features, exported from the Traycer epic that produced them. Each document carries `kind`/`status` frontmatter (`status: 0` todo · `1` in progress · `2` complete). These are records of decisions and evidence, not living docs — the code is the source of truth for current behavior.

| Tree | Contents | State |
|---|---|---|
| `dynamic-command-cell-technical-plan/` | Technical plan, 8 implementation tickets with independent review records, qualification evidence, and rollout readiness checklist for dynamic command cells (this branch / PR #1835) | Implemented; ships dark (all rollout switches off); real-MultispeQ hardware matrix pending |
| `dynamic-command-cell-core-flows/` | Product-level flows and success criteria for dynamic commands | Settled |
| `dynamic-command-cell-artifact-critique/` | Adversarial critique of the dynamic-command plan (pre-implementation) | Record |
| `changeset-walkthroughs/` | Reviewer-oriented walkthrough of the dynamic-command changeset | Record |
| `workbook-loops-technical-plan/` | Technical plan (rev 3), session provenance & streaming completeness companion, adversarial critique with rev-2 re-review, and 11 implementation tickets for workbook loops (Expression / Processing-step model) | Planned; not yet implemented |

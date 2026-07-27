---
title: "Close web freshness-race and macro-scope blockers"
kind: ticket
status: 2
---

# Close web freshness-race and macro-scope blockers

Parent: [Execute dynamic command cells safely on web](../../index.md)

Independent review rejected the initial implementation on three settled safety invariants. This amendment must pass before ticket 5 or web authoring can complete.

## Required fixes

### 1. Bind async execution to its starting generation

- Capture provenance/generation synchronously at the start of every protocol, static/ref command, macro, question, manual, branch, and Run-all execution.
- After every await, commit registry entries, previews, execution state, and display outputs only if that captured generation is still active.
- Clear, authored edit, entity-design edit, workbook-key change, and Run-all invalidation must make every older completion inert. An older manual run may never overwrite a newer Run-all result.
- Add deferred-promise tests for Clear, workbook-key change, authored cell edit, entity-code edit, and overlapping manual/Run-all execution.

### 2. Invalidate immediately on executable entity changes

- Add a synchronous authored-design revision/invalidation signal owned by the workbook execution host.
- Protocol and macro code, language, fork/source, or other executable entity changes must invalidate immediately when edited, not only after debounced persistence or version repinning.
- Preserve existing external entity-saved behavior while composing it with execution invalidation.
- Add protocol-code and macro-code edit tests plus explicit design-revision/workbook-key tests.

### 3. Derive macro scope from runtime provenance

- Determine macro scope from the strict predecessor registry entry keyed by `producedBy`, never from optional display `deviceResults` length.
- A device-scoped predecessor remains device-scoped for one or many devices and through a one-device branch subset.
- Only genuinely workbook/shared input/context may produce a shared macro result.
- Add one-device producer→macro→dynamic-command, changed-device/reconnect, and per-device macro normalization tests.

### 4. Complete host-level coverage and telemetry

- Add a multi-path dynamic device-branch test proving exact commands, valid-device continuation, and zero transport for invalid devices.
- Assert previews clear immediately and cannot repopulate from stale completion.
- Route allowlisted resolver failure metadata through the existing durable client telemetry abstraction if one exists; keep console output development-only and never include resolved/source/device-error data.

## Acceptance criteria

- No completion that started in an older generation can modify runtime freshness, previews, execution state, or display outputs.
- Executable protocol/macro edits invalidate prior output before another command can run.
- A result derived from one device can never become shared solely because only one device result was displayed.
- Direct, Run-all, loop, and branch dispatch preserve exact-device partial-success behavior.
- Static execution and authored payload immutability remain green.

## Re-review closure requirements

The first amendment pass remains incomplete. Its re-review is recorded in [the amendment review](./review/index.md) and adds these concrete closure requirements:

- Make executable-edit invalidation synchronous. The edit context must call the execution invalidator before local/editor state changes; do not wait for a `designRevision` effect. Successful protocol/macro fork or source changes must use the same boundary.
- Drive macro execution multiplicity, inputs, errors, exact device ids, and result normalization exclusively from the fresh predecessor `RuntimeCellOutput`. Never promote or copy scope from display `deviceResults`.
- Check generation after every macro await and rejection, stop launching remaining device work when stale, and make non-Run-all invalidation synchronously reset stale execution and Run-all UI state.
- Replace the nominal branch test with two real device groups and distinct dynamic commands. Add callback-before-effect, stale macro rejection, invalidated Run-all UI, immediate preview clearing, and PostHog allowlist/production-console coverage.

## Second re-review closure requirements

The second implementation pass closed the device fan-out, async macro, UI reset, branch, and telemetry findings. Two freshness-authority gaps remain:

- When a macro has a preceding output cell, require a matching fresh runtime predecessor. Shared macro input may come only from `predecessor.data`; device macro input may come only from exact `predecessor.deviceResults`. Never promote persisted/display `input.data` after mount, Clear, or a new epoch. Only macros with no preceding output may use workbook context without a predecessor.
- Split authored editor changes from execution-owned cell writes. The authored editor callback must compare the non-output design and synchronously invalidate the generation before `setCells`; execution-owned output, answer, evaluated-path, and collapse updates must keep their existing non-invalidating path.
- Add callback-level race tests: stale display output → new epoch → macro → ref command must make no transport call, and an ordinary authored edit must invalidate before a deferred producer can commit or overwrite that edit, without waiting for effects.

## Third re-review closure requirements

The third implementation pass removed display fallback and split editor callbacks, but closure additionally requires:

- Treat registry presence and registry freshness separately. Before a macro consumes a predecessor, require exact provenance equality with the current workbook/design key and execution epoch. A mismatch is missing/stale and must cause zero macro execution, registry promotion, display-data read, or later command transport—even during the render-to-effect workbook-key handoff.
- Execution completion must apply runtime-owned changes to the latest cells rather than replace the captured pre-await array. Preserve concurrent non-invalidating authored/UI fields such as `isCollapsed`; keep question-answer, evaluated-path, and output mutations coherent.
- Strengthen timing coverage so the authored callback and deferred completion happen within the same mocked editor event, before effects can flush. Add Clear → immediate macro → ref zero-transport coverage, a workbook-key provenance-mismatch case, a fresh shared-predecessor macro success case, and an assertion that collapse remains set after producer completion.

## Fourth re-review closure requirements

The fourth pass added a start-time predecessor guard and merge helper, but the execution boundary must be corrected as a whole:

- Capture an immutable execution token at start containing both generation and provenance. After every await and before every registry, preview, execution-state, returned-cell, or display-output commit, require the generation to remain active and the captured provenance to equal current provenance. Stamp outputs only with the captured provenance—never a newly read value after awaiting.
- Replace whole-array merge semantics with explicit execution-owned deltas against the latest host state. A completion may update only the cell it ran, its owned question/branch runtime fields, and its producer output. It must preserve other executions' outputs/answers/evaluations, order, membership, collapse state (including output collapse), and must never resurrect cells removed by an invalidating edit or Clear.
- Add adversarial concurrency tests for two producers completing in both orders, output replacement without duplicates, two questions, two branches, output collapse, Clear/no resurrection, and a workbook-key change during a deferred operation before effect cleanup. Timing tests must establish synchronous call ordering rather than rely only on RTL `rerender`/effect flushing.

## Fifth re-review closure requirements

The run-token and delta model is correct in principle, but two host/run ownership boundaries still need closure:

- A queued host transform must re-check its token when React actually applies it, not only before enqueueing. Invalidating after enqueue but before application must yield the latest cells unchanged. Keep the committed workbook/design key in a commit-phase layout boundary; render or aborted-render mutation must not alter the key seen by committed handlers.
- Branch target-consumption state belongs to a single manual or Run-all execution. Replace the hook-global set with a run-local context threaded through nested dispatch so overlapping manual/Run-all/branch runs cannot clear or consume one another's target ids.
- Preserve the latest collapse state of an owned output when replacing its data. Add delayed-transform-after-Clear/key-change tests and concurrent manual/Run-all two-group branch coverage proving each routed command executes once for only its assigned devices.

## Sixth re-review closure requirement

One committed lifecycle boundary remains:

- Change the committed workbook/design key and invalidate the runtime atomically in the same layout-phase callback. A key transition must bump generation, create the new epoch, clear registry/previews/execution/Run-all state, synchronize signature backstops, and publish the new committed key without a layout-to-passive window. Remove passive workbook-key invalidation while retaining passive authored-signature defense.
- Add a layout-window regression that starts a synchronous producer immediately after a key-changing commit but before passive effects. It must capture the new key and new epoch, remain valid, and not be cleared or leave stranded display output; old queued transforms must remain inert.

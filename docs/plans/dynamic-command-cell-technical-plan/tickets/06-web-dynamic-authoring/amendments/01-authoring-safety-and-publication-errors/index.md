---
title: "Close web authoring safety and publication-error gaps"
kind: ticket
status: 2
---

# Close web authoring safety and publication-error gaps

Parent: [Add repairable dynamic-command authoring behind the web flag](../../index.md)

Independent review found four acceptance gaps. This amendment must pass before Ticket 6 or cross-host qualification can complete.

## Required fixes

### Question source semantics

- Selecting a question must atomically persist `sourceCellId` and `field: "answer"`, including transitions from an empty ref or a stale non-question field.
- Define and test the reverse transition so a hidden question-only field is not accidentally retained as a valid non-question choice.

### Flag-off structural lock

- With the authoring flag false or unavailable, an existing ref remains readable, runnable, and collapsible but cannot be edited, converted, or deleted.
- Keep runtime Run separate from authoring/structural actions and preserve the exact authored ref payload.

### Backend structural issue handling

- Strictly parse the production-safe `WORKBOOK_STRUCTURAL_VALIDATION_FAILED` error envelope and allowlisted `details.issues`; never render arbitrary error details.
- Attach and upgrade failures must keep the review/repair context open and map valid issues by `commandCellId` to translated guidance. Malformed/unknown details fall back to the generic error.
- Add real oRPC-shaped tests with extra sentinel fields proving no raw data leaks and the relevant command remains repairable.

### Translation and accessibility

- Replace inline English authoring, repair, tooltip, placeholder, shared-question, fallback, and ARIA copy with translation keys.
- Add complete keys for every supported web locale and tests for dynamic authoring plus backend structural-error states.

## Acceptance criteria

- A selected question always authors the only legal field, `answer`.
- Flag-off owners can Run an existing ref but cannot Delete or mutate it.
- Sanitized server issues reach the correct command-cell repair UI; malformed details remain generic and payload-safe.
- Dynamic authoring and repair UI contains no new hard-coded user-facing English.
- The authoring flag remains default-off; backend publication and CMS rollout gates remain disabled.

## Re-review closure requirements

The first amendment pass closed question semantics and flag-off locking, but four integration gaps remain:

- Handle structural attach failures centrally across linked-workbook, empty-workbook selected-existing, and new-experiment selected-workbook paths. Preserve projected issue identity and present repairable workbook/command context keyed by `commandCellId`; do not report experiment creation/attachment success or navigate as attached after rejection.
- Reset upgrade mutation error state on a fresh review/target and after repair so a prior server rejection cannot permanently disable Confirm. Add an integrated reject → repair/reopen → successful retry test.
- Make the structural-error parser total and own-property safe against inherited fields, throwing accessors, proxies, arrays, and null-prototype objects. Malformed or hostile input must return `null` without throwing or exposing sentinels.
- Localize source fallback/type labels and correct `nodeUnreachable` guidance: it describes the command node being off the authored ordinary chain/unreachable from flow start, not a referenced source missing from every path. Cover the actual supported en-US/de-DE locale set.

## Second re-review closure requirements

One repair-context path and its accessibility boundary remain:

- On new-experiment selected-workbook structural rejection, preserve the projected issue list, every `commandCellId`, and attempted workbook id in durable visible UI before navigation. Provide exact repair links to the workbook and the created unattached experiment; do not reduce the result to an unactionable toast or navigate to a destination that discards context.
- Make asynchronously rendered structural issue regions accessible with an atomic live alert/status or focused titled region. Decorative icons must be hidden from assistive technology, and repair links need descriptive names. Cover multiple command ids, sentinel stripping, exact routes, live-region semantics, and link names.

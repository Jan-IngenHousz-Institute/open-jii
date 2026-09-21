---
name: openjii-review
description: Review a diff adversarially in four passes, each with a different lens, fixing and verifying findings before moving on. Use before marking your own work ready, when reviewing someone else's pull request, or when a change looks finished and you want to know what it broke.
---

# Reviewing a diff

Read `AGENTS.md` first, and the `docs/standards/` document for each area the diff touches. Those
documents are the bar this review measures against.

If you wrote the code, you are the worst-positioned person to review it, and knowing that does not
fix it. Structure does: several passes, each with a different lens, each producing findings you fix
and verify before the next one starts. One pass is a re-read, not a review.

## Ground rules

**Read the code. Do not run rituals.** Re-running the suite and calling it a review is theatre.
Tests verify what someone already thought of; a review exists to find what nobody did. Run a suite
to verify a fix, not to decide whether there is anything to fix.

**Review the whole diff against the merge base.** `git merge-base origin/main HEAD` and then every
hunk, in every layer the change reaches: infrastructure, pipeline, contract, backend, frontend,
mobile, docs, tests. If the diff contains a file you cannot explain, stop and explain it. Upstream
drift, debris and accidents all look like ordinary hunks.

**Verify every finding against the current code before you act on it.** Plausible is not confirmed.
A finding from memory, from a tool's summary or from the pull request description is a hypothesis.

**Fix in the same pass, with a test that pins it.** A fix without a test is reported as left, with
the reason. Then re-run only what the fix touches.

**Report honestly.** A finding you chose not to fix is listed with the reason. A problem that was
already there is named as pre-existing, not fixed silently, because fixing it takes the branch
outside its scope, and not claimed as something this change introduced.

## Pass 1: does it do the right thing

Hunt the bug that type-checks and passes the tests.

- **Cross-surface invariants.** If the interface hides or forbids something, does the server also
  reject it? Walk every mutation endpoint the diff adds or changes and ask which states it accepts
  that the design excludes. Interface gating without API gating is the classic gap here.
- **State machines and pairing.** Feed them out-of-order, duplicated and orphaned events on paper.
  First and last element. Empty input. Two of the same thing in a row.
- **Races and rollbacks.** What happens when two of these run at once? Does the failure cleanup
  destroy the winner's work? Does a retry converge or diverge?
- **Boundary trust.** Which fields are claimed by the client and which are proven by the system? Are
  you joining and filtering on the proven one?
- **Time and zones.** Every `new Date`, every truncation, every bucket boundary and every label. Who
  computes in UTC, who displays local, and do they agree?
- **Authorization and secrets.** Every new route carries a guard. No secret in code, in a log line
  or in an error body. New input is parameterised, not interpolated. A new dependency is one you can
  account for.
- **Data lineage**, for anything touching `apps/data` or the lakehouse. Name the source table, the
  transformation and the target. Is a rerun idempotent? Does a column keep its meaning end to end,
  rather than being renamed at the sink to make an export work?

## Pass 2: is it honest about itself

- Does each piece live where this codebase says it lives? Match the patterns in the repo, not ones
  imported from somewhere else. If you invented a layer or a pattern, justify it or dissolve it.
- Kill dead code, unused fields, imports and loggers, knowledge duplicated where a single source
  exists, and magic numbers derivable from the literals they describe.
- **Comments must be true and unspeculative.** Delete any that assert runtime behaviour nobody
  verified, reference the current task, or narrate the obvious. A wrong comment costs more than no
  comment.
- **Observability.** Does a new failure path log enough to find it later, at the right level, with
  no personal data in the line? Is a new analytics event named like its neighbours?
- Naming: would a reader who did not watch this being built understand every name without asking?

## Pass 3: what it costs

- Count the queries and calls per user action and per polling interval, then multiply by viewers. N
  calls that could be one grouped call is a finding.
- A poll rate has to match how fast the data actually changes.
- Unbounded things: input without a cap, fan-out without a limit, a cache without eviction, a list
  that only grows. Bound it, or write down the accepted ceiling with a number.
- Separate "fix now" from "accepted trade-off", and write the trade-offs down so they read as
  decisions rather than oversights.

## Pass 4: the tails

- **Tests mirror the code.** Every new file and branch with logic has a test that would fail if the
  logic broke, asserting semantics rather than lines. Every test you changed still tests something.
- **Docs and contracts.** Generated specs regenerated and synced. Glossaries, READMEs, context
  documents and any table that enumerates the thing you extended. Error codes. Copy in every
  maintained locale, with no orphaned keys.
- **Accessibility**, for anything with an interface: a keyboard path, labels, contrast through the
  tokens rather than literals, and where focus lands after a dialog closes.
- **Migrations and configuration.** Generated artefacts consistent, a migration that is reversible
  and separates a backfill from a schema change, permissions for every new API call, and how the
  change interacts with a feature flag or a staged rollout.
- **The diff itself.** No stray files, no leftover debugging, formatting clean, and the full gate
  green at the end.

## Severity

| Severity | Means                                                                                    |
| -------- | ---------------------------------------------------------------------------------------- |
| Critical | Blocks the merge: a security hole, data loss, broken behaviour, a violated invariant.    |
| Required | Fix before merge: a missing test, the wrong layer, an unhandled failure, migration risk. |
| Optional | Worth doing. The author decides.                                                         |
| Nit      | Style or taste. Ignorable.                                                               |

## How to write a finding

One per line, so a reader and a script can both count them:

```text
- [C1] apps/backend/src/x/y.ts:42 CONFIRMED. Claim: the guard reads the client-supplied id.
  Scenario: a member posts another org's id and the row is created under that org.
  Fix: applied, pinned by y.spec.ts "rejects a foreign organization id".
```

`CONFIRMED` means you reproduced it by reading the current code path end to end, or with a test.
`PLAUSIBLE` means you could not close the scenario. Never fix a `PLAUSIBLE` finding silently:
list it for the author, because a fix for a problem nobody has confirmed is a change nobody can
review. Use `Left:` with a reason in place of `Fix:` where you chose not to act.

## The report

```text
## Review of <branch or PR> against <merge base sha>

Verdict: approve | request changes

### Pass 1 to 4
Findings in the format above, then either "Nothing else found" or "Stopped: the remaining
findings are defensible to leave", with the defence.

### Fixed, with the test that pins each one
### Deliberately left, with reasons
### Could not verify from here, and the step that would settle it
### Pre-existing and out of scope
### Verification
Diff read end to end: yes or no. Gate run: the command and the result.
```

## When you are done

You are done when a pass produces only findings you can defend not fixing. Then write the report.
If you cannot verify something from where you sit, say so and name the step that would settle it for
whoever deploys it.

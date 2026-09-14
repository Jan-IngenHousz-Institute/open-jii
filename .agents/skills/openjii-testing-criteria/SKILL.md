---
name: openjii-testing-criteria
description: Write the two developer sections a ticket needs before review - How it was built, and Testing criteria that QA can run without having built the change - from the ticket's acceptance criteria and the actual diff, then mirror them into the PR. Use when a PR is ready for review, when a ticket is about to move to In Testing, or when an In Testing ticket has no testing section.
---

# Testing criteria for the handoff

Read `AGENTS.md` first. The testing gate and the shape of the two sections are in
`docs/agents/ticket-standard.md`. Access and query recipes are in `openjii-linear`.

A ticket may enter `In Testing` only with a non-empty `## How it was built` and
`## Testing criteria`. Those sections are what the requester, the TPM or the intern execute on dev.
This skill writes them from evidence, gets the developer to confirm them, and only then lets the
ticket move on.

## Inputs

Read all three before drafting a line:

1. The ticket: its acceptance criteria, its comments, its project's `## Done when`.
2. The diff: the branch against `main`, or `gh pr diff <n>`. Every criterion must trace to a
   changed line or an acceptance criterion.
3. The Critical Flows document in Linear (recipe in `openjii-linear`), to say which tier the change
   touches and whether any tier 1 smoke test needs re-running.

## How it was built

A short paragraph: the approach, the notable decisions, anything a reviewer or a later reader would
want to know. Under 600 characters. Not a file list; the diff already is one.

## Testing criteria

Written for someone who did not build it. The shape mirrors the smoke tests in Critical Flows:

```markdown
## Testing criteria

Environment: dev, web or mobile internal track. What accounts, organizations, devices or data the
tester needs before step 1. Which Critical Flows tier this touches.

1. Where to go and what to do. Expected: what is observably true afterwards.
2. ...
3. Negative: the case that must be refused or absent. Expected: ...
```

Rules:

- One action per step, one observable expected result per step. "Works correctly" is not a result.
- Cover each acceptance criterion at least once, the alternative flows the ticket names, and the
  negative case for any permission or validation rule the diff touches.
- Say what data the tester needs and how to get it. A step nobody can set up is not a step.
- Under 1,200 characters. If the criteria run longer, the ticket was too big; say so.

## The one rule

**Never invent beyond the diff.** A criterion you cannot trace to a changed line or an acceptance
criterion is a question for the developer, not a line in the ticket. Where the diff and the
acceptance criteria disagree, stop and say so; that is a finding, not something to paper over.

## Writing it back

1. Run the prose standard from `ticket-standard.md` on both sections. A failed check stops there.
   Then the `unslop` skill.
2. Show both sections to the developer and wait for confirmation.
3. Write them to the ticket, replacing the empty sections, never appending a second copy.
4. Paste the same testing criteria into the PR's "Testing Instructions" section so the two never
   diverge. The ticket is canonical.
5. Only then does the ticket move on: to `In Review` when the PR is marked ready (PR automation, or
   by hand), and to `In Testing` on merge. Refuse to move a ticket to `In Testing` yourself while
   either section is empty.

If the ticket is already in `In Testing` without these sections, write them with the developer who
built it and do not move the ticket back.

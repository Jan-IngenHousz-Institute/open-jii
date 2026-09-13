---
name: openjii-prepare-release
description: Prepare an openJII release, or rehearse one, by checking what has shipped, choosing a release branch, drafting Contentful notes and a Linear update, assessing mobile force updates, and capturing web or phone media.
---

# Prepare a release

Read `AGENTS.md` first. Run commands from the repository root unless a command says otherwise.

## Choose the work once

Reuse choices and authorization already given. Ask for the remaining choices together, with your
inferred answers shown. A plain "prepare a release" needs these decisions, not five separate turns:

| Choice                 | Suggested answer                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------- |
| Cut a release branch?  | Yes for a web/backend/data cut; `release/DDMMYYYY` from the intended release date.      |
| Make CMS notes?        | Unpublished drafts, with audience based on the tracks actually shipping.                |
| Force a mobile update? | No unless an incompatibility requires a newer native build. Investigate when uncertain. |
| Add a Linear update?   | Draft a project update; ask for a destination before posting.                           |
| Capture media?         | A shot list first; web screenshots, phone screenshots, or phone video when selected.    |

Also establish the candidate ref or PRs and whether this is preparation or a mock run. A mock run
uses live read-only discovery when available but creates only local files: no branches, pushes, CMS
writes, Linear posts, flag changes, workflow dispatches, or phone interactions that change app data.
If the user asks to exercise every path in a mock, simulate all choices and label them simulated.

Create `.release-prep/<release-id>/packet.md`. Record choices, evidence, drafts, pending actions, and
returned IDs there. Keep secrets in the ignored root `.env`; use [`.env.example`](.env.example) as a
key list, adding only missing keys to an existing file. Do not overwrite the user's `.env`.

## Establish what is being released

Follow [release discovery and branch creation](references/release.md). Finish with:

- Last verified production SHA and workflow per affected app, plus a separate mobile native/OTA
  baseline. Unknown production state stays unknown.
- Exact candidate SHA and PRs, divided into already shipped, included, pending, and unexplained.
- Changes users will notice, migrations/compatibility concerns, and flags that still prevent access.

Check all requested PRs by ancestry and inspect their diffs. A requested feature that is absent from
the candidate is pending, even if its note has been drafted. For a requested device launch, search
all `IOT_DEVICES` / `iot-devices` uses, including backend controllers, web gates, tests and contracts.
Removing those gates is separate implementation work. Preserve authorization guards and distinguish
product flags from mock-device switches. Never announce general availability while access remains gated.

## Prepare the selected outputs

Run independent work even when another selected step lacks credentials. Report missing key names,
never values. A missing optional integration does not block a local packet or an unrelated step.

| Selected work            | Read and execute                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Branch                   | [Release recipe](references/release.md#cut-the-branch), only at the verified candidate SHA.                                         |
| CMS notes or mobile gate | [Contentful recipe](references/contentful.md). Notes use the tested devkit writer; gate changes use the exact versioned CMA recipe. |
| Screenshots or video     | [Media recipe](references/media.md), reusing the repo Playwright and phone skills.                                                  |
| Linear                   | [Linear recipe](references/linear.md), keeping a project update distinct from release synchronization.                              |

Write release notes for researchers, grounded in included changes. A pending feature belongs in the
internal packet, not in public copy. Keep mobile notes unpublished until that audience can get the
release; `surfaces: both` must not announce a mobile release on web deployment day.

Before an external preparation write, make the exact payload and destination reviewable. Use existing
authorization for that operation; ask only if it is missing. Selecting a CMS draft authorizes draft
creation, not publication. Selecting a Linear post authorizes that post once its destination and copy
are concrete. Draft-only choices remain local. Publication, forced-update activation, deployment,
store promotion and PostHog administration are handoff actions: prepare exact commands and conditions
without executing them as part of this skill.

## Hand back a release packet

Mark each selected step `done`, `drafted`, `blocked`, or `skipped`, with evidence and the next action.
Include branch/SHA, release comparison, CMS entry IDs and versions, Linear destination and draft or
posted URL, media files with review status, and the gate's minimum/store evidence/rollback if selected.
Recheck candidate refs before declaring the packet ready. An unresolved prerequisite means
"preparation complete; release blocked", not "ready to go live".

For a mock, include the exact operations that would run, their payloads and blockers, and verify that
no external writes occurred. Example invocation: "Use openjii-prepare-release to mock the next release
including PR #2074 and device flag removal. Exercise every option without publishing anything."

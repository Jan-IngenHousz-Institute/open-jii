# Triage labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual
label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role, for example "apply the AFK-ready triage label", use the corresponding
label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Where these labels live

Apply them as **Linear** labels on team `OJD`, since Linear is the source of truth. See
`issue-tracker.md`.

Of the five, only `wontfix` already exists on the GitHub mirror, and the mirror's own label set
(`Bug`, `Web`, `Mobile`, `Epic`, the `releaseProd-*` series, the `WBSO*` series) covers a different
axis: area, type and release, not triage state. So these five are additions rather than renames, and
they do not collide with anything in use.

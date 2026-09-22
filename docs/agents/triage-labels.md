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

> **None of these five exist in Linear yet.** An audit of the `OJD` label set found all five
> missing, so a skill that applies one today will fail. They are listed as pending creations in
> `linear-taxonomy.md`, under a `triage` label group. Create them before relying on this file.

Once created they sit in an exclusive `triage` group, so an issue carries at most one. Grouping does
not change the strings: a label under a `triage` group is still named `needs-triage`, not
`triage/needs-triage`, so anything matching these names keeps working.

They do not collide with anything in use. The existing `OJD` labels cover area, type, release and
the WBSO reporting series, none of which express triage state. On the GitHub mirror only `wontfix`
exists, and the mirror is fed from Linear, so Linear is where they need creating.

# Roles in an organization

Organizations group people together and own the resources they work on: experiments, protocols, macros, and workbooks (and, in the future, devices). In this sense an organization's resources are analogous to repositories on a code-hosting platform: they are the units that people are granted access to.

Every openJII user automatically gets a **personal organization** when they sign up. This is their personal workspace, and they are its owner. Beyond that, users can create or be invited to shared organizations that they collaborate in with others.

An organization defines two things that determine what its people can do:

- **Organization roles** — owner, admin, or member. Roles control who can manage the organization itself, and they set the baseline level of access each person has to the organization's resources.
- **The base permission** — an organization-wide setting that decides what a plain member can do with the organization's resources by default. See [Base permissions](./004-base-permissions.md).

This page covers the three organization roles and what each one can do.

## The three organization roles

Every person in an organization holds exactly one organization role.

| Role | Purpose |
| :--- | :--- |
| **Owner** | Full administrative control of the organization. Owners manage settings, membership, teams, and roles, and always have full access to every resource the organization owns. An organization should always have at least one owner. |
| **Admin** | Manages the organization day to day. Admins can manage membership, teams, and resources, and like owners they always have full access to every resource the organization owns. |
| **Member** | The default role for everyone else in the organization. A member's access to the organization's resources is governed by the organization's **base permission**, and can be raised or lowered for specific resources through explicit grants. |

Owners and admins are the administrators of the organization. The key distinction from a member is that **owners and admins always have full access to every resource the organization owns**, regardless of the base permission or any per-resource setting. A member, by contrast, starts with whatever access the base permission allows.

## What each role can do

The matrix below summarizes the permissions tied to each organization role. These are organization-level capabilities; per-resource access is layered on top (see [Per-resource access](#how-this-fits-with-per-resource-access)).

| Capability | Member | Admin | Owner |
| :--- | :---: | :---: | :---: |
| Belong to the organization | ✓ | ✓ | ✓ |
| View resources allowed by the base permission | ✓ \* | ✓ | ✓ |
| Be added to a team | ✓ | ✓ | ✓ |
| Be granted access to a specific resource | ✓ | ✓ | ✓ |
| Full access to **every** resource the organization owns | – | ✓ | ✓ |
| Create resources owned by the organization | ✓ \*\* | ✓ | ✓ |
| Manage teams (create, delete, change membership) | – | ✓ | ✓ |
| Invite and remove people | – | ✓ | ✓ |
| Change a person's organization role | – | ✓ \*\*\* | ✓ |
| Change organization settings (directory visibility, base permission) | – | – | ✓ |
| Delete the organization | – | – | ✓ |

`*` A member's default access to resources is set by the organization's base permission. With a base permission of `none`, a member has no implicit access and needs an explicit grant. See [Base permissions](./004-base-permissions.md).
`**` Whether a plain member can create resources depends on the organization's settings; owners and admins always can.
`***` Admins manage roles for members but cannot change owners.

## How roles interact with the base permission

The organization role determines a person's **baseline** access to the organization's resources:

```text
Owner / Admin  ->  always full access to every org resource
Member         ->  access defined by the organization's base permission
```

The **base permission** is one of `none`, `read`, or `admin` (default: `read`):

- `none` — members get no implicit access; they need an explicit grant to see or touch a resource.
- `read` — members can view all of the organization's resources.
- `admin` — members can manage all of the organization's resources.

Changing the base permission only affects plain members. Owners and admins are unaffected and keep full access. For the complete behavior, see [Base permissions](./004-base-permissions.md).

Explicit resource grants **always override** the base permission. So a member can be given more access to a particular experiment than the base permission would imply (for example, `admin` on one experiment while the base permission is `read`), and a member can be granted access to a specific resource even when the base permission is `none`.

## How this fits with per-resource access

Organization roles and the base permission set the baseline. On top of that, access can be tuned per resource through **grants**, and resources can be shared beyond the organization:

- A grant can target an individual user, a [team](#teams), or an entire organization, each with a role of **owner**, **admin**, **member**, or **viewer**. Owner and admin can edit, manage, and share the resource; member and viewer are read-only. See [Sharing resources](./008-sharing-resources.md).
- A person who holds a grant on a resource but is **not** a member of that resource's owning organization is an **Outside Collaborator**. They are labeled as such in the resource's collaborators list and cannot be added to teams.

The roles described on this page are the organization layer. The per-resource layer for experiments — experiment admin and experiment member — is described in [experiment roles](../003-data-platform/002-web-platform/0020-roles.md).

### Access precedence

When openJII decides whether a person may perform an action on a resource, it checks the following in order and stops at the first match:

1. **Owner or admin of the owning organization** → full access.
2. **Plain member of the owning organization** → the organization's base permission applies.
3. An **explicit grant to the user** on that resource.
4. An **explicit grant to a team** the user belongs to.
5. An **explicit grant to an organization** the user belongs to.
6. If the resource is **public** and the action is **read** → allowed; otherwise denied.

Because explicit grants (steps 3–5) are evaluated as access in their own right, they let you raise a member's access above a restrictive base permission for specific resources.

## Teams

A **team** is a flat group of organization members used to grant access to several people at once. Only people who are members of the organization can be on a team. Teams have no nesting and no visibility levels: you simply add and remove members. When a team is granted access to a resource, every member of that team inherits that access. Outside Collaborators cannot be added to teams.

## Organization directory visibility

Separate from the roles above, each organization has a **directory visibility** setting that controls whether other users can discover it:

- **Public** — the organization is listed in the organization directory, and users can request to join it.
- **Private** — the organization is invite-only and does not appear in the directory. This is the default.

Directory visibility affects discovery of the organization, not access to its resources. Resource access is always governed by roles, the base permission, and grants as described above.

## Related pages

- [Base permissions](./004-base-permissions.md) — the organization setting that defines a member's default access.
- [Sharing resources](./008-sharing-resources.md) — grants, collaborators, and Outside Collaborators.
- [Experiment roles](../003-data-platform/002-web-platform/0020-roles.md) — the per-resource access layer for experiments.

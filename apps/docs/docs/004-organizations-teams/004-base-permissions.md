# Setting base permissions

An organization's **base permission** is the default level of access that every plain member of the organization has to the resources the organization owns. Setting it lets an owner decide, in one place, how much access members get automatically when they join.

## About base permissions

Organizations group people and own resources: experiments, protocols, macros, and workbooks (and devices). A resource in openJII is analogous to a repository in other platforms, the unit that access is granted on.

Each organization has a single base permission setting. It applies to **plain members only** and determines what they can do across all of the organization's resources without any further configuration:

| Base permission | What a plain member can do with the organization's resources                                  |
| :-------------- | :-------------------------------------------------------------------------------------------- |
| `none`          | No implicit access. Members see and act on a resource only if they receive an explicit grant. |
| `read`          | View all of the organization's resources (read-only). This is the default.                    |
| `admin`         | Manage all of the organization's resources: view, edit, and share them.                       |

The default base permission for a new organization is `read`.

Base permissions apply to every plain member, both existing members and anyone who joins later. Changing the setting changes what all current members can do.

### Owners and admins are always full

Base permissions never apply to organization **owners** or **admins**. Owners and admins always have full access to every resource the organization owns, regardless of the base permission. Lowering the base permission to `none` restricts members but has no effect on owners or admins.

This also means that every user has full control of their **personal organization** (their personal workspace): each account automatically gets one and is its owner.

### Explicit grants always override the base permission

The base permission is only the default. An explicit grant on a specific resource always overrides it, in either direction:

- If the base permission is `none` (or `read`), you can still grant an individual member, a team, or another organization a higher role on a specific resource, and that grant wins.
- If the base permission is `admin`, a member still keeps that broad access; explicit grants are layered on top for finer control.

A grantee who holds a grant on a resource but is **not** a member of that resource's owning organization is labeled an **Outside Collaborator** in the resource's collaborators list and cannot be added to teams. For how grants are evaluated against the base permission, see [Access precedence](./011-access-precedence.md).

> **Note**
> Base permissions interact with resource visibility. Every resource is `public` or `private`, and if a resource is public, anyone can read it regardless of the organization's base permission. Visibility is monotonic: a private resource can be made public, but a public resource can never be made private again.

## Setting the base permission

Only an organization owner or admin can change the base permission. The change takes effect immediately for all current and future members.

1. Open the organization and go to its **Settings**.
2. Under member access, find the **Base permission** setting.
3. Choose `none`, `read`, or `admin` from the options.
4. Confirm the change. The new default applies to every plain member of the organization.

Because the change affects all existing members, review who is in the organization before lowering the base permission. Members who relied on the previous default will lose that access unless they have an explicit grant on the resources they need.

## Choosing a value

- Use `read` (the default) when you want every member to be able to see all of the organization's experiments and other resources, but edit only what they are explicitly granted.
- Use `admin` for small, high-trust organizations where every member should be able to manage everything the organization owns.
- Use `none` for organizations where access should be deliberate: members start with nothing and are given access resource by resource, through grants to individual users, [teams](./007-organizing-members-into-teams.md), or the organization.

## Further reading

- [Organization roles](./003-organization-roles.md)
- [Sharing resources](./008-sharing-resources.md)
- [Access precedence](./011-access-precedence.md)

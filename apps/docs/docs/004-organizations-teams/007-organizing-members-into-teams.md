# Organizing members into teams

Teams let you group the people in an organization so you can manage access to resources for many people at once. Instead of granting access to a resource one person at a time, you grant it to a team, and every member of that team inherits that access.

## About teams

A team is a flat group of organization members. You use teams to manage access for groups of people who work together, such as a lab group, a field crew, or a working group within your organization.

Teams in openJII are deliberately simple:

- **Teams are flat.** There is no team nesting in openJII. A team has members, and that is all. There is no concept of parent teams or child teams.
- **There are no secret or hidden teams.** Teams do not have visibility levels. Every team in an organization is visible to the people who can see the organization.
- **Only organization members can be on a team.** You add people to a team by selecting from the organization's members. Anyone who is not a member of the organization cannot be added to a team. In particular, an [Outside Collaborator](./008-sharing-resources.md) — someone who has a grant on a single resource but is not a member of the owning organization — cannot be put on a team.

Teams exist to make sharing easier. When you grant a team access to a resource, every member of that team gets that access for as long as they are on the team. Add a person to the team and they pick up the team's access automatically; remove them and they lose it. This is the main reason to use teams: you manage one membership list instead of editing access on every resource separately.

For background on what organizations are and how resources are owned and shared, see [Sharing resources](./008-sharing-resources.md).

## Where teams fit in the access model

openJII organizations group people and own resources — experiments, protocols, macros, and workbooks (and devices, which are covered by their own area of the platform). A resource is the thing you share and control access to.

Access to a resource is decided by checking a fixed order of rules. The first rule that matches wins.

1. If you are an **owner or admin** of the organization that owns the resource, you have full access. Owners and admins always have full access to every resource the organization owns.
2. Otherwise, if you are a **plain member** of the owning organization, your access is the organization's **base permission** (`none`, `read`, or `admin`).
3. Otherwise, if there is an **explicit grant to you** on the resource, that grant applies.
4. Otherwise, if there is an **explicit grant to a team you are on**, that grant applies. *This is where teams come in.*
5. Otherwise, if there is an **explicit grant to an organization you belong to**, that grant applies.
6. Otherwise, if the resource is **public** and the action is read, it is allowed. Otherwise access is denied.

Explicit grants always override a restrictive base permission. So even if an organization's base permission is `none`, granting a team access to a specific resource gives every team member that access.

## Creating a team

Organization owners and admins can create teams. To create a team:

1. Open your organization and go to its **Teams** view.
2. Choose to create a new team.
3. Give the team a name. Pick something that describes the group of people, such as `field-crew` or `data-analysts`.
4. Optionally add a description so other people in the organization understand the team's purpose.
5. Create the team.

Because teams are flat, there is no parent to choose and no visibility level to set. A newly created team has no members and no resource access until you add them.

After creating the team, you will typically want to:

- Add organization members to the team (see below).
- Grant the team access to one or more resources, so its members inherit that access. See [Sharing resources](./008-sharing-resources.md).

## Adding and removing members

You manage a team by editing its member list. Organization owners and admins can add members to or remove members from any team.

To add a member:

1. Open the team and go to its **Members** list.
2. Choose to add a member.
3. Select a person from the organization's members. You can only add people who are already members of the organization.
4. Confirm. The person is now on the team and immediately inherits every grant the team holds.

To remove a member:

1. Open the team's **Members** list.
2. Find the person and remove them from the team.

When you remove someone from a team, they lose any access they had **only** through that team. If they still have access another way — for example a direct grant on the resource, the organization's base permission, or membership on another team that holds a grant — that access is unaffected.

> If you want to add someone who is not yet in the organization, invite them to the organization first. Once they accept and become a member, you can add them to teams. To give a non-member access to a single resource without adding them to the organization, grant the resource to them directly; they become an Outside Collaborator on that resource and cannot be added to teams.

## Granting a team access to a resource

The point of a team is that you grant access **once**, to the team, and every member inherits it. A team can be granted access to any resource the organization owns — an experiment, protocol, macro, or workbook.

A grant carries a role. The roles available for any grant (to a user, a team, or an organization) are:

| Role     | What members of the granted team can do                          |
| :------- | :--------------------------------------------------------------- |
| `owner`  | Edit, manage, and share the resource (full control)              |
| `admin`  | Edit, manage, and share the resource                             |
| `member` | View the resource (read-only)                                    |
| `viewer` | View the resource (read-only)                                    |

`owner` and `admin` can edit, manage, and share the resource. `member` and `viewer` are read-only.

To grant a team access to a resource:

1. Open the resource and go to its collaborators or sharing view.
2. Add a grant, choosing the team as the grantee.
3. Pick the role the team should have on this resource.
4. Save the grant.

Every current member of the team now has that role on the resource, and anyone you add to the team later picks it up automatically. To change the team's access, edit the grant's role; to revoke it, remove the grant. Removing the grant does not remove anyone from the team — it only takes away the access the team conferred.

Because explicit grants sit above the organization's base permission in the precedence order, a team grant is the right tool when most of the organization should have limited access (a `none` or `read` base permission) but one group needs more on a specific resource.

### Example

Suppose your organization's base permission is `read`, so every plain member can view the organization's resources but not edit them. You have a workbook that the analysis group needs to edit.

1. Create a team called `data-analysts`.
2. Add the analysts as members of the team.
3. Grant the `data-analysts` team `admin` access to the workbook.

Now the analysts can edit that workbook, while the rest of the organization keeps read-only access through the base permission. When a new analyst joins, you add them to the team and they can edit the workbook immediately — you never touch the workbook's sharing settings again.

## Teams and visibility

Granting a team access is separate from a resource's visibility. Every resource is either public or private. New resources default to public, and visibility is monotonic: a private resource can be made public, but a public resource can never be made private again. (Experiments can also be private under an embargo that automatically publishes them on a set date.) Team grants govern who can edit, manage, and share a resource; they do not change whether the resource is publicly readable. For details on visibility, embargoes, and sharing, see [Sharing resources](./008-sharing-resources.md).

## Further reading

- [Sharing resources](./008-sharing-resources.md)
- [Roles and rights](../003-data-platform/002-web-platform/0020-roles.md)

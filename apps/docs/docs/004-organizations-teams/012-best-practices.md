# Best practices for organizations

An organization in openJII groups people together and owns the resources they work on — experiments, protocols, macros, workbooks, and (from a separate effort) devices. A resource is the unit you share, set visibility on, and grant access to.

This page collects practical guidance for running a healthy organization: keeping ownership resilient, managing access through teams rather than one-off grants, leaning toward openness for research data, granting the least access that gets the job done, and choosing a base permission that matches how open your organization really is.

If you are new to these concepts, the following pages cover them in depth:

- [Base permissions](./004-base-permissions.md)
- [Organizing members into teams](./007-organizing-members-into-teams.md)
- [Sharing resources](./008-sharing-resources.md)

## Assign more than one owner

Every user automatically gets a personal organization — their personal workspace — and is its owner. Shared organizations are different: they outlive any single person, so they should never depend on one.

An organization has three roles: **owner**, **admin**, and **member**. Owners and admins manage the organization and always have full access to every resource the organization owns; a plain member's access is governed by the organization's base permission. Because owners hold the highest level of control, a single owner is a single point of failure. If that person loses access, changes roles, or leaves the project, no one may be able to invite members, adjust the base permission, or recover resources.

We recommend assigning at least two owners to every shared organization. For day-to-day administration that does not require full ownership, promote trusted people to **admin** instead — they can manage members and resources without being able to remove other owners.

## Use teams instead of many individual grants

When several people need the same access to the same resources, granting each of them individually is tedious to set up and easy to get wrong over time. As people join and leave, individual grants drift out of date, and it becomes hard to answer a simple question: who can see this experiment, and why?

Teams solve this. A team is a flat group of organization members. You add and remove members, grant the team access to a resource once, and every member of the team inherits that access. When someone joins the team they pick up all of its grants automatically; when they leave, that access goes away.

Some guidance for teams:

- **Model teams on how people actually work** — a lab group, a field campaign, a working group on one protocol family. The team becomes the single place you manage that group's access.
- **Grant to the team, not the people.** Reserve individual grants for genuine exceptions, and prefer adjusting team membership over editing grants on each resource.
- **Remember teams are flat.** openJII teams do not nest and have no visibility levels — there are no sub-teams and no hidden teams. If you need a different grouping, create another team rather than trying to layer one inside another.
- **Only organization members can be on a team.** Someone who has a grant on one of your resources but is not a member of the organization is an outside collaborator and cannot be added to a team. To bring them into your teams, invite them to the organization first.

See [Organizing members into teams](./007-organizing-members-into-teams.md) for the full workflow.

## Prefer openness, and keep embargoes short

openJII is built for sharing research data, and the platform's defaults reflect that. New resources are created **public**, and resource visibility is **monotonic**: a private resource can be made public, but once a resource is public it can never be made private again. Published data stays published — this rule is enforced by the backend, so there is no way to walk it back. Treat the choice to publish as final.

When work genuinely needs to stay private for a while — for example, until a paper is submitted — use an **embargo** rather than keeping the resource private indefinitely. An experiment can be private with an embargo date: it stays private until that date and is then automatically published by a job that runs daily at midnight UTC. The default embargo is 90 days from creation. Because the embargo only ever flips a resource from private to public, it is consistent with monotonic visibility — it sets a deadline for openness rather than a way around it.

Recommendations:

- **Default to public** unless you have a concrete reason to restrict a resource.
- **Use the shortest embargo that protects your work**, and let it expire rather than recreating private copies.
- **Decide on visibility before you publish**, not after — there is no undo once a resource is public.

## Grant the least access needed

When you share a resource, grant the smallest role that lets the recipient do their job. You can grant access to an individual user, a team, or an entire organization, and each grant carries a role:

| Role | What it allows |
| --- | --- |
| **owner** | View, edit, manage, and share the resource. |
| **admin** | View, edit, manage, and share the resource. |
| **member** | Read-only access. |
| **viewer** | Read-only access. |

Owner and admin grants can edit, manage, and re-share the resource; member and viewer grants are read-only. Reach for read-only roles by default and grant edit or management rights only to the people who need them.

A few things worth keeping in mind:

- **You can invite someone by email even if they do not have an openJII account yet.** The grant is waiting for them when they sign up.
- **Granting to an entire organization is powerful** — every current and future member of that organization picks up the access. Use it deliberately, and prefer a team when the audience is narrower than the whole organization.
- **Watch for outside collaborators.** A grantee who has a grant on one of your resources but is not a member of the resource's owning organization is labelled an **Outside Collaborator** in the collaborators list. Outside collaborators are fine for targeted, time-bound work, but review them periodically — they sit outside your organization's teams and base permission, so they are easy to forget.

See [Sharing resources](./008-sharing-resources.md) for details on creating and managing grants.

## Pick a base permission that matches how open your organization is

The **base permission** is an organization setting that defines the default access every plain member has to the resources the organization owns. It does not affect owners and admins, who always have full access. It has three possible values:

| Base permission | What a plain member can do with org resources |
| --- | --- |
| **none** | No implicit access. Members need an explicit grant to see or touch a resource. |
| **read** | View all of the organization's resources. |
| **admin** | Manage all of the organization's resources. |

The default is **read**. Choose the value that reflects how your organization actually operates:

- **read** suits most research groups, where everyone is expected to see the group's work even if not everyone edits it. This is a good starting point.
- **none** suits organizations that hold sensitive or compartmentalized work, where membership alone should not imply access. Members then see only what they have been explicitly granted, through individual, team, or organization grants.
- **admin** suits small, high-trust groups where every member is effectively an administrator. Use it sparingly — it gives every member management rights over every resource the organization owns.

Explicit resource grants always override the base permission, in both directions. A grant can open up a single resource even when the base permission is **none**, and the platform always honours the most specific applicable grant. So a restrictive base permission is not a wall — it is a default that you selectively open up with grants.

See [Base permissions](./004-base-permissions.md) for the full reference.

## How access is decided

When someone tries to act on a resource, openJII evaluates a fixed order of rules and stops at the first one that matches. Understanding this order helps you predict the effect of a base permission, a team grant, or a public visibility setting before you change anything.

```text
1. Owner or admin of the owning organization        -> full access
2. Plain member of the owning organization          -> the org's base permission
3. An explicit grant to the user                     -> that grant's role
4. An explicit grant to a team the user is on        -> that grant's role
5. An explicit grant to an organization the user is in -> that grant's role
6. Resource is public and the action is read         -> allowed
   otherwise                                          -> denied
```

A few consequences fall out of this order:

- **Owners and admins are never blocked** by visibility or base permission on resources their organization owns — rule 1 always wins for them.
- **Explicit grants override a restrictive base permission.** If the base permission is **none**, a grant to the user, a team they are on, or an organization they belong to still gives access.
- **Public resources are readable by anyone**, but only for read actions. Public visibility never grants the ability to edit, manage, or share.

Knowing the precedence makes the earlier recommendations concrete: lean on the base permission for the common case, use teams for shared access, reserve individual grants for exceptions, and remember that publishing a resource is the broadest grant of all — and a permanent one.

*An organization's base permission applies only to the resources that organization owns; it has no effect on resources owned by other organizations, even if your members hold grants on them.

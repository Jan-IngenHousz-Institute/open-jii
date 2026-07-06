# Outside collaborators

An outside collaborator is someone who holds a grant on a specific resource but is **not a member of the organization that owns that resource**. Outside collaborators let you bring in a guest researcher, a partner lab, or a reviewer to work on a single experiment, protocol, macro, or workbook without giving them any standing in your organization.

This page explains how outside collaborators appear, how to add and remove them, and the two limits that distinguish them from organization members. For the full picture of how access is granted to a resource, see [Sharing resources](./008-sharing-resources.md).

## About outside collaborators

In openJII, organizations group people and own resources, and resources are shared by creating **grants**. A grant gives a user, a team, or an entire organization a role on a resource: owner, admin, member, or viewer.

When the grantee of a resource is **not** a member of the organization that owns that resource, they are an outside collaborator on it. Their access comes entirely from the explicit grant you gave them, and from nothing else: they do not pick up the owning organization's base permission, and they cannot reach the resource by being on one of that organization's teams.

A few consequences follow directly from this definition:

- An outside collaborator is always tied to a **specific resource**. The same person can be an outside collaborator on one experiment and a full member of a different organization at the same time.
- Because every user automatically gets a personal organization (their personal workspace) where they are the owner, "not a member of the owning organization" simply means they live in their own organization, or another one, rather than yours.
- Removing the grant removes their access. There is no separate membership to clean up.

## How outside collaborators appear

When you open the collaborators list of a resource, each grantee is shown with the role you gave them (owner, admin, member, or viewer). Grantees who are not members of the resource's owning organization carry an additional **"Outside Collaborator"** label next to their name.

This label is informational. It does not change what the person can do on the resource, which is determined solely by the role on their grant. It exists so that owners and admins can tell at a glance which collaborators are guests from outside the organization versus members who already belong to it.

```text
Collaborators for "Drought stress 2026" (owned by Greenhouse Lab)

  Asha Okafor      admin     (member of Greenhouse Lab)
  Field Team       member    (team)
  Lin Zhao         viewer    Outside Collaborator
  partner@uni.edu  member    Outside Collaborator (invited)
```

## Adding an outside collaborator

You add an outside collaborator the same way you share any resource: you grant a non-member access to it. You do not "invite them to the organization" first, and there is no separate outside-collaborator flow. Granting access to someone who is not a member of the owning organization is what makes them an outside collaborator.

1. Open the resource you want to share (an experiment, protocol, macro, or workbook) and go to its collaborators view.
2. Choose to grant access to an **individual user**. Search for an existing user or enter an email address.
3. Pick the role for the grant:
   - **owner** or **admin** can edit, manage, and re-share the resource.
   - **member** or **viewer** are read-only.
4. Confirm the grant.

If the email address belongs to an existing openJII account that is not in your organization, that person becomes an outside collaborator on the resource immediately. If the email does not match any account yet, an invitation is sent; once the person creates an openJII account, the pending grant is applied automatically and they appear as an outside collaborator.

Grants to teams and to whole organizations behave the same way: any grantee who is not a member of the owning organization is shown as an outside collaborator. In practice, though, individual grants are the usual way to add an outside collaborator, because the two limits below restrict the team route.

## Removing an outside collaborator

Because an outside collaborator's access is just a grant, you remove them by **revoking that grant**.

1. Open the resource and go to its collaborators view.
2. Find the collaborator carrying the **"Outside Collaborator"** label.
3. Revoke their grant.

Their access to that resource ends immediately. Revoking a grant on one resource has no effect on any other resource: if the same person is an outside collaborator on several of your experiments, you revoke each grant separately. There is no organization membership to remove, since an outside collaborator was never a member to begin with.

If you accidentally invited the wrong email address and the invitation has not yet been accepted, revoking the pending grant cancels the invitation.

## Two limits that set outside collaborators apart

Outside collaborators differ from organization members in two specific ways.

| | Organization member | Outside collaborator |
| :--- | :---: | :---: |
| Can be added to a team | ✓ | – |
| Receives the organization's base permission on org resources | ✓ | – |
| Access to a resource comes from an explicit grant | ✓ | ✓ |

### They cannot be added to a team

Teams are flat groups of organization members. Only members of an organization can be on one of its teams, so an outside collaborator cannot be added to a team. If you want a guest to inherit a team's access, you would first need to make them a member of the organization, at which point they are no longer an outside collaborator.

### They do not get the organization's base permission

Every organization has a **base permission** (none, read, or admin) that defines the default access a plain member has to the organization's resources. Outside collaborators are not members, so the base permission never applies to them. Their access is exactly what their grant says and nothing more. This is why an organization can keep a permissive base permission for its own members while a viewer-level outside collaborator still sees only the single resource you shared.

## How this fits the access model

When openJII decides whether someone may perform an action on a resource, it checks the following in order and stops at the first match:

1. Owner or admin of the owning organization → full access.
2. Plain member of the owning organization → the organization's base permission.
3. An explicit grant to the user.
4. An explicit grant to a team the user is on.
5. An explicit grant to an organization the user belongs to.
6. If the resource is public and the action is read → allowed; otherwise denied.

An outside collaborator never matches steps 1 or 2, because they are not in the owning organization. Their access is decided at step 3 (the grant you gave them) and, occasionally, at steps 4 or 5 if they were reached through a team or organization grant. Explicit grants always override a restrictive base permission, so a grant is enough on its own to give an outside collaborator exactly the access you intend.

Keep resource **visibility** in mind as well. Every resource is public or private; new resources default to public, and visibility is monotonic (a private resource can be made public, but a public one can never be made private again). Experiments may additionally carry an embargo, staying private until an embargo date (90 days from creation by default) when a daily job publishes them. If a resource is public, anyone can already read it under step 6, so you only need an outside-collaborator grant when you want a guest to do more than read, or to read something that is still private.\*

For the step-by-step on creating and managing grants, see [Sharing resources](./008-sharing-resources.md). For experiment-level roles in the web platform, see [Roles and rights](../003-data-platform/002-web-platform/0020-roles.md).

`*` A grant on a private resource also lets a collaborator read it before it is published, which a public resource would expose to everyone.

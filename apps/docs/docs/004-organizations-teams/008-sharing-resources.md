# Sharing resources

In openJII, every experiment, protocol, macro, and workbook is a **resource** that is owned by an organization. (Devices are resources too, covered separately in the devices documentation.) You can give other people access to a resource by creating a **grant**, choosing both *who* gets access and *what they can do*.

openJII uses one sharing model for every resource type. Once you understand how to share an experiment, you already know how to share a protocol, a macro, or a workbook: the grantees and roles are the same everywhere.

## What you can share, and with whom

A grant always has two parts: a **grantee** (who) and a **role** (what they can do).

You can grant access to any of the following grantees:

* **An individual user** — a single person, identified by their openJII account or by email address.
* **A team** — a group of organization members. Every member of the team inherits the grant. See [Organizing members into teams](./007-organizing-members-into-teams.md).
* **An entire organization** — every member of that organization receives the grant.

You can grant access even to someone who does not yet have an openJII account. See [Inviting people by email](#inviting-people-by-email) below.

## Roles and what each role can do

Each grant carries one of four roles. From most access to least:

* **Owner** — full control: read, edit, manage settings, and share the resource with others.
* **Admin** — same as owner for day-to-day work: read, edit, manage, and share.
* **Member** — read-only access to the resource.
* **Viewer** — read-only access to the resource.

Owner and admin are the **manage-and-edit** roles. Member and viewer are the **read-only** roles. Choose the role that fits each person or team's part in your work, without giving more access than they need.

### Role to capability matrix

| Capability | Owner | Admin | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: |
| View the resource and its data | ✓ | ✓ | ✓ | ✓ |
| Edit the resource (content, settings) | ✓ | ✓ | - | - |
| Manage the resource (e.g. change visibility \*) | ✓ | ✓ | - | - |
| Share the resource (create, change, revoke grants) | ✓ | ✓ | - | - |

`*` Visibility changes are **monotonic**: a private resource can be made public, but a public resource can never be made private again. See [Resource visibility and embargo](./010-resource-visibility-and-embargo.md).

> Note: a resource's **experiment** roles for contributors (taking measurements in the field, adding flags and comments) are described in detail under [experiment roles](../003-data-platform/002-web-platform/0020-roles.md). The owner/admin/member/viewer roles on this page are the grant roles that govern sharing across all resource types.

## How a grant fits with organization access

A grant is not the only way someone can reach a resource. When openJII decides whether a person may perform an action on a resource, it checks the following in order, and the **first match wins**:

1. **Owner or admin of the owning organization** — always has full access to every resource the organization owns.
2. **Plain member of the owning organization** — access is set by the organization's **base permission** (`none`, `read`, or `admin`; the default is `read`).
3. **An explicit grant to the user** on this resource.
4. **An explicit grant to a team** the user is on.
5. **An explicit grant to an organization** the user belongs to.
6. **Public resource, read action** — anyone may read a public resource.

If none of these apply, access is denied.

Two consequences are worth remembering:

* **Explicit grants override a restrictive base permission.** If your organization's base permission is `none`, members have no implicit access, but a grant you create still gives a specific person, team, or organization exactly the access you choose.
* **Owners and admins of the owning organization are never affected by grants or base permission.** They always have full access.

For more on the organization-wide default, see the base permission setting on your organization. To grant access to people who are *not* in your organization, see [Outside collaborators](./009-outside-collaborators.md).

## Inviting people by email

You do not need a grantee to already have an openJII account.

1. Open the resource you want to share and go to its **Collaborators** view.
2. Search for an existing user, or type an email address.
3. Choose the role (owner, admin, member, or viewer).
4. If the email matches a registered user, they are added immediately with that role.
5. If the email does not match any account, openJII sends an **invitation** by email. The grant stays pending until the person accepts.
6. When the invitee creates an openJII account, the pending grant is **automatically accepted** and applied with the role you specified.

You can change the role of a pending invitation, or revoke it, before it is accepted.

## Outside collaborators

A grantee who has a grant on a specific resource but is **not** a member of that resource's owning organization is an **outside collaborator**. They appear in the collaborators list labeled "Outside Collaborator" and cannot be added to teams (teams contain only organization members).

Outside collaborators are useful for sharing a single experiment or protocol with a partner from another lab without adding them to your whole organization. See [Outside collaborators](./009-outside-collaborators.md) for details.

## Viewing who has access

Open the resource and go to its **Collaborators** view to see everyone who has a grant on it. For each entry you can see:

* the grantee (an individual user, a team, or an organization),
* the role of the grant (owner, admin, member, or viewer),
* whether the grantee is an organization member or an **outside collaborator**, and
* whether the grant is still **pending** (an emailed invitation that has not yet been accepted).

The Collaborators view shows **explicit grants** on the resource. Access that comes from being an owner/admin of the owning organization, or from the organization's base permission, is not listed here as a per-resource grant, because it applies across all of the organization's resources.

## Changing a grant's role

You can raise or lower the role of any existing grant.

1. Open the resource and go to its **Collaborators** view.
2. Find the user, team, or organization whose access you want to change.
3. Select a new role (owner, admin, member, or viewer).

The new role takes effect immediately. For a grant to a team or an organization, the change applies to every member of that team or organization.

## Revoking a grant

You can remove a grant at any time.

1. Open the resource and go to its **Collaborators** view.
2. Find the grantee you want to remove.
3. Remove the grant.

When you revoke a grant, the grantee loses the access that grant provided. Keep the precedence rules in mind: a person may still be able to reach the resource through another path. For example, if they are an owner or admin of the owning organization, or if the organization's base permission grants `read` or `admin`, or if the resource is public and the action is read, they retain that access even after the explicit grant is removed.

To remove someone's access entirely, make sure no other path applies: check their organization role, the organization's base permission, any team grants, and the resource's visibility.

## Related pages

* [Organizing members into teams](./007-organizing-members-into-teams.md) — create teams and grant a whole team access at once.
* [Outside collaborators](./009-outside-collaborators.md) — share a single resource with people outside your organization.
* [Resource visibility and embargo](./010-resource-visibility-and-embargo.md) — public vs. private resources, monotonic visibility, and experiment embargo.
* [Experiment roles](../003-data-platform/002-web-platform/0020-roles.md) — contributor roles within an experiment.

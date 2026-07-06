import DocButton from '@site/src/components/DocButton';

# About organizations

Organizations are shared accounts where researchers and teams can collaborate across many experiments at once. They group people together and **own resources**, so you can manage access centrally instead of granting people access to one item at a time.

## What an organization owns

An organization owns the research artifacts created under it. In openJII these resources are:

- **Experiments** — the studies you design and run, with their measurements, locations, and metadata.
- **Protocols** — measurement procedures.
- **Macros** — reusable analysis logic.
- **Workbooks** — protocol and macro development environments.

Devices (sensors and their calibration) are also owned by organizations, but they are covered separately and are only mentioned here in passing.

A resource is the unit you share, set visibility on, and grant people access to. Every resource belongs to exactly one owning organization.

## Your personal organization

Every user automatically gets a **personal organization** when they sign up. This is your personal workspace, and you are its **owner**. Anything you create on your own — a quick experiment, a draft protocol, a scratch workbook — lives here by default.

When you are ready to collaborate at scale, you can [create a shared organization](./002-creating-an-organization.md) for your lab, project, or institution, and invite others to join it.

<div style={{marginTop: '0.6rem'}}>
	<DocButton href="./002-creating-an-organization.md" variant="primary">Create an organization</DocButton>
</div>

## Public and private organizations

Each organization has a directory visibility that controls how people find it:

| Visibility | Who can find it | How people join |
| --- | --- | --- |
| **Public** | Discoverable in the organization directory | Anyone can request to join; an owner or admin approves the request |
| **Private** | Not listed in the directory | Invite-only |

New organizations are **private** by default. Directory visibility only affects discoverability and joining — it does not change the visibility of the resources the organization owns. Resource visibility is set per resource (see [below](#resource-visibility)).

## Organization roles

Every member of an organization has one of three roles:

| Role | What they can do |
| --- | --- |
| **Owner** | Full control of the organization, its settings, and every resource it owns. |
| **Admin** | Manages the organization and its members, and has full access to every resource the org owns. |
| **Member** | A regular participant. Access to the org's resources is governed by the organization's **base permission** (see below). |

Owners and admins **always** have full access to every resource the organization owns — this cannot be reduced by a base permission or a grant.

## Base permission

The **base permission** is an organization setting that defines the default access every plain member has to the resources the organization owns. It is one of:

| Base permission | Default access for plain members |
| --- | --- |
| `none` | No implicit access. Members see nothing until they receive an explicit grant. |
| `read` | Members can view all of the organization's resources. |
| `admin` | Members can manage all of the organization's resources. |

The default base permission is `read`.

Two things never change, regardless of the base permission:

- **Owners and admins are unaffected** — they always have full access.
- **Explicit resource grants always override the base permission.** A grant can give a member more access than the base permission allows (for example, `admin` on one experiment when the base is `read`), and it can be used to grant access at all when the base is `none`.

## Teams

A **team** is a flat group of organization members, used to grant access to many people at once. Teams in openJII are intentionally simple:

- There is **no team nesting** — teams cannot contain other teams.
- There are **no secret or visibility levels** for teams.
- You manage a team by adding and removing members. Only members of the organization can be on a team.

When a team is granted access to a resource, **every member of that team inherits that access**. Add someone to the team and they pick up the team's grants; remove them and they lose that path of access.

## Resource sharing with grants

Beyond the base permission, you can share an individual resource by creating a **grant**. A grant can target:

- an **individual user**,
- a **team**, or
- an **entire organization**.

Each grant carries a role:

| Grant role | What it allows |
| --- | --- |
| **Owner** | Read, edit, manage, and share the resource. |
| **Admin** | Read, edit, manage, and share the resource. |
| **Member** | Read-only. |
| **Viewer** | Read-only. |

You can invite a person by **email even if they do not yet have an account**. The grant takes effect once they create an account and accept the invitation.

### Outside collaborators

A grantee who has a grant on a specific resource but is **not a member of that resource's owning organization** is an **outside collaborator**. They appear in the resource's collaborators list labeled **Outside Collaborator**, and because they are not org members, they **cannot be added to teams**. To add someone to a team, first add them to the organization.

## Resource visibility

Every resource is either **public** or **private**.

- **New resources default to public.**
- Visibility is **monotonic**: a private resource can be made public, but **once a resource is public it can never be made private again**. Published data stays published. This rule is enforced by the backend.

When a resource is public, anyone can read it, regardless of organization membership or grants. Write, manage, and share actions still require an appropriate role.

### Experiment embargo

An experiment can be private with an **embargo date**. It stays private until that date, and is then **automatically published** (made public) by a job that runs daily at midnight UTC. The default embargo is **90 days from creation**.

The embargo is consistent with monotonic visibility: it only ever flips an experiment from private to public, never the reverse.

## How access is decided

When openJII evaluates whether you can perform an action (such as reading or editing) on a resource, it checks the following rules in order and uses the **first one that matches**:

```text
1. Are you an owner or admin of the owning organization?   -> full access
2. Are you a plain member of the owning organization?      -> the org's base permission
3. Is there an explicit grant to you as a user?            -> that grant's role
4. Is there an explicit grant to a team you belong to?     -> that grant's role
5. Is there an explicit grant to an organization you're in? -> that grant's role
6. Is the resource public and the action a read?           -> allowed
   otherwise                                                -> denied
```

Because explicit grants (rules 3–5) are checked before the public-read fallback and can exceed the base permission, **a grant can lift a member above a restrictive base permission**. For example, with a base permission of `none`, a member has no implicit access until a grant on a specific resource gives them one.

## In this section

- [Creating an organization](./002-creating-an-organization.md)
- [Organization roles](./003-organization-roles.md)
- [Base permissions](./004-base-permissions.md)
- [Managing membership](./005-managing-membership.md)
- [Inviting members and join requests](./006-inviting-and-join-requests.md)
- [Organizing members into teams](./007-organizing-members-into-teams.md)
- [Sharing resources](./008-sharing-resources.md)
- [Outside collaborators](./009-outside-collaborators.md)
- [Resource visibility and embargo](./010-resource-visibility-and-embargo.md)
- [Access precedence](./011-access-precedence.md)
- [Best practices](./012-best-practices.md)

:::info
Parts of this section are adapted from [GitHub Docs](https://github.com/github/docs) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), rewritten and modified for openJII. openJII is not affiliated with or endorsed by GitHub.
:::

# Creating an organization

Organizations group people together and **own resources**: experiments, protocols, macros, and workbooks (and, in the future, devices). Each resource always belongs to exactly one organization.

When you create an organization, it starts out empty, with no resources attached. You become its **owner** and can begin inviting members, creating teams, and adding resources right away.

> **You already have one.** Every openJII account is given a **personal organization** automatically. This is your personal workspace, and you are its owner. You don't need to create a new organization to start working; create one when you want a shared space for a lab, project group, or institution.

## Create a new organization

1. Open the organization switcher in the top bar and choose **Create organization**.
2. Fill in the organization details (see below).
3. Confirm. You are added as the **owner**, and openJII switches you into the new organization so you can start inviting people and adding resources.

### Organization details

| Field | Required | Notes |
| --- | --- | --- |
| **Name** | Yes | The display name shown across openJII, for example *Plant Photosynthesis Lab*. |
| **Slug** | Yes | A short, URL-friendly identifier (lowercase letters, numbers, and hyphens). It must be unique and appears in links to the organization. |
| **Organization type** | Yes | Describes the kind of group, for example a research lab, institution, or project team. |
| **Description** | No | A short summary of what the organization works on. |
| **Website** | No | A link to your lab, group, or institution homepage. |
| **Location** | No | Where the organization is based. |

The description, website, and location make up the organization's public profile and help others recognise your group in the organization directory.

## Choose the directory visibility

Organization **directory visibility** controls whether other openJII users can find your organization:

| Visibility | Who can find it | Who can join |
| --- | --- | --- |
| **Private** *(default)* | Not listed in the organization directory | Invite-only |
| **Public** | Discoverable in the organization directory | Anyone can request to join; an owner or admin approves the request |

New organizations are **private** by default. You can change the visibility later in the organization settings. Directory visibility is about discovery and joining only; it is separate from the visibility of individual resources, which each have their own public or private setting.

## What happens next

Creating the organization is just the first step. To set it up for collaboration, you will typically:

- **Invite members** so colleagues can join. Public organizations can also receive join requests. See [Inviting members and handling join requests](./006-inviting-and-join-requests.md).
- **Create teams** to group members who work together, then grant a team access to resources so every member of the team inherits it. See [Organization roles](./003-organization-roles.md) for who can manage teams.
- **Set the base permission** to decide what level of access a plain member gets to the organization's resources by default. See [Base permissions](./004-base-permissions.md).

### Roles at a glance

Every person in an organization has one of three roles. Owners and admins always have full access to every resource the organization owns; a plain member's default access is governed by the organization's base permission.

| Role | Manages the organization | Access to org resources |
| --- | --- | --- |
| **Owner** | Yes | Always full |
| **Admin** | Yes | Always full |
| **Member** | No | Determined by the [base permission](./004-base-permissions.md)* |

\* An explicit grant on a specific resource always overrides the base permission for that resource. For the full role breakdown, see [Organization roles](./003-organization-roles.md).

### Base permission at a glance

The **base permission** is an organization setting and the default access every plain member has to the resources the organization owns:

| Base permission | What plain members can do |
| --- | --- |
| **None** | No implicit access; members need an explicit grant on a resource |
| **Read** *(default)* | View all of the organization's resources |
| **Admin** | Manage all of the organization's resources |

Owners and admins are never affected by this setting; they always have full access. To learn how the base permission interacts with teams, individual grants, and resource visibility, see [Base permissions](./004-base-permissions.md).

## Related pages

- [Organization roles](./003-organization-roles.md)
- [Base permissions](./004-base-permissions.md)
- [Inviting members and handling join requests](./006-inviting-and-join-requests.md)
- [Experiment roles](../003-data-platform/002-web-platform/0020-roles.md)

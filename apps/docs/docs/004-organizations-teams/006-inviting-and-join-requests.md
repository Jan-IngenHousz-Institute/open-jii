# Inviting members and handling join requests

An organization grows in two ways. An owner or admin can **invite** a person by email, or — when the organization is public — a user can **request to join**. This page covers both flows, who can use them, and what happens to a person's access once they are in.

For everything you can do with people who are already members (changing roles, removing members, base permission), see [Managing membership](./005-managing-membership.md).

## How organizations and members fit together

An organization groups people and **owns resources**: experiments, protocols, macros, and workbooks (and, from a separate epic, devices). Resources are the things an organization holds and shares with its members and collaborators.

Every user automatically gets a **personal organization** (their personal workspace) and is its owner. Beyond that, people join organizations as members in one of three roles:

| Role | What it means |
| :--- | :--- |
| **owner** | Manages the organization and always has full access to every resource the org owns. |
| **admin** | Manages the organization and always has full access to every resource the org owns. |
| **member** | A plain member. Access to org resources is governed by the organization's **base permission** (see below), unless an explicit grant says otherwise. |

Owners and admins always have full access to org resources, so the invitation and join-request flows below mainly determine *who becomes a member* and *which role they start with*.

## Two ways to grow an organization

```text
Owner/admin invites by email   ─────────►  invitation link  ─────►  member
User requests to join (public) ─────────►  pending request  ─────►  member
                                           (owner/admin approves or rejects)
```

Which flows are available depends on the organization's **directory visibility**:

- **Public** — the organization is discoverable in the organization directory, and any user can request to join. Owners and admins can still invite by email.
- **Private** — invite-only. The organization is not listed in the directory and cannot be joined by request. Inviting by email is the only way in. Private is the default.

## Inviting a member by email

Owners and admins can invite anyone to join the organization by email address. This works whether or not the invitee already has an openJII account.

1. Open the organization's **Members** view and choose to invite a member.
2. Enter the invitee's email address and pick the role they should receive: **owner**, **admin**, or **member**.
3. Send the invitation. The invitee receives an email with an **invitation link**.

What happens next depends on whether the person already has an account:

- **They have an account.** They open the invitation link and accept it. They become a member with the role you chose.
- **They do not have an account yet.** When they sign up using the same email address the invitation was sent to, the invitation is **accepted automatically** — they land in the organization with the role you specified, with no extra step.

Until an invitation is accepted it stays **pending**. An owner or admin can revoke a pending invitation, or send a new one with a different role.

> A pending invitation grants no access. The person becomes a member — and gains whatever access that role and the organization's base permission imply — only once the invitation is accepted.

## Requesting to join a public organization

On a **public** organization, a user can ask to join without waiting for an invitation.

1. From the organization directory, the user opens a public organization they are not a member of and submits a **join request**.
2. The request is **pending** until an owner or admin acts on it.
3. An owner or admin **approves** the request (the user becomes a member) or **rejects** it (no membership is created).
4. While the request is still pending, the requester can **cancel** it.

A join request to a private organization is not possible — private organizations are invite-only and do not appear in the directory.

### Request states

| State | Meaning |
| :--- | :--- |
| **pending** | Submitted, awaiting an owner/admin decision. The requester can cancel it. |
| **approved** | An owner/admin accepted it; the user is now a member. |
| **rejected** | An owner/admin declined it; no membership was created. |
| **cancelled** | The requester withdrew the request before a decision was made. |

## What a new member can access

Becoming a member does not, by itself, grant access to every resource. A member's default access is set by the organization's **base permission**, one of:

| Base permission | What a plain member can do with org resources |
| :--- | :--- |
| **none** | No implicit access. The member needs an explicit grant on a resource to use it. |
| **read** | View all of the organization's resources. (Default.) |
| **admin** | Manage all of the organization's resources. |

Owners and admins are unaffected by the base permission — they always have full access. And an **explicit grant** on a specific resource always overrides the base permission, in either direction: it can give a member more access than the base permission allows, or give access to someone whose base permission is `none`.

For the full picture — including teams, sharing individual resources, outside collaborators, and how access is decided when several rules apply — see [Managing membership](./005-managing-membership.md) and [experiment roles](../003-data-platform/002-web-platform/0020-roles.md).

## Related

- [Managing membership](./005-managing-membership.md) — roles, base permission, removing members, and resource sharing.
- [Roles and rights](../003-data-platform/002-web-platform/0020-roles.md) — how roles and grants play out on an individual experiment.

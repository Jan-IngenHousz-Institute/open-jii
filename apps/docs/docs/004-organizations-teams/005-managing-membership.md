# Managing organization membership

An organization groups people together and owns shared resources — experiments, protocols, macros, workbooks (and, in the future, devices). As an owner or admin, you manage who belongs to the organization, what role each person holds, and when people leave. This page covers viewing the members list, changing a member's role, removing a member, and leaving an organization.

To bring new people in, see [Inviting members and handling join requests](./006-inviting-and-join-requests.md). For a full breakdown of what each role can do, see [Organization roles](./003-organization-roles.md).

## Viewing the members list

Every organization has a **Members** page that lists everyone who currently belongs to it. To open it, switch to the organization using the organization switcher in the top bar, then go to the organization's **Members** section.

For each person the list shows:

- Their name and account.
- Their **organization role**: owner, admin, or member.
- Whether they are a full member or an **Outside Collaborator** (someone who has a grant on a specific resource but is not a member of this organization). Outside Collaborators are labeled as such and cannot be added to teams.

Owners and admins can act on members from this page — changing roles and removing people. Plain members can view the list but cannot manage it.

## Understanding what a role grants

A member's organization role determines both how much of the organization they can administer and how much of its resources they can reach by default.

| Role | Manages the organization | Default access to the organization's resources |
| :--- | :--- | :--- |
| Owner | Full control: settings, members, teams, visibility | Always full access to every resource the org owns |
| Admin | Manages members, teams, and resources | Always full access to every resource the org owns |
| Member | Cannot manage the organization | Governed by the organization's **base permission** |

Owners and admins always have full access to every resource the organization owns; this cannot be reduced. A plain member's access, however, depends on the organization's **base permission** setting:

| Base permission | What a plain member can do with the org's resources |
| :--- | :--- |
| `none` | No implicit access — a member needs an explicit grant to reach a resource |
| `read` | View all of the organization's resources (the default) |
| `admin` | Manage all of the organization's resources |

The base permission is the floor for plain members, not a ceiling. An explicit grant on a specific resource — to the person directly, to a team they are on, or to an organization they belong to — always overrides the base permission, including raising access above a restrictive `none`. For how to choose and change this setting, see [Base permissions](./004-base-permissions.md).

:::note
Promoting someone to admin or owner gives them full access to **every** resource the organization owns, regardless of the base permission or any individual grants. Reserve those roles for people who should administer the whole organization.
:::

## Changing a member's role

Owners and admins can change the role of any member from the **Members** page.

1. Open the organization's **Members** page.
2. Find the person whose role you want to change.
3. Open the role control next to their name and choose **Owner**, **Admin**, or **Member**.
4. Confirm the change.

A few things to keep in mind:

- **Promoting to owner or admin** immediately gives the person full access to all of the organization's resources.
- **Demoting an owner or admin to member** drops them back to the organization's base permission for resources they do not have an explicit grant on. If they still need access to a particular experiment or workbook, add an explicit grant before or after the change.
- An organization must always have at least one owner. You cannot demote or remove the last remaining owner.

## Removing a member

When someone no longer needs to belong to an organization, an owner or admin can remove them.

1. Open the organization's **Members** page.
2. Find the person you want to remove.
3. Choose **Remove from organization** for that person.
4. Review the effects below, then confirm.

### Effects of removing a member

When you remove someone from an organization:

- They lose their organization role and the implicit access that came with it (the base permission for plain members, or full access for owners and admins).
- They lose membership in every team in that organization, and any resource access they had **through** those teams.
- Any explicit grant made directly to that person on a specific resource is **not** automatically removed. If they still hold a direct grant, they remain a collaborator on that resource — but now as an **Outside Collaborator**, since they are no longer a member of the owning organization. To revoke that access, remove the grant on the resource itself.
- Resources stay where they are. The organization continues to own its experiments, protocols, macros, and workbooks; removing a person never deletes or transfers a resource.
- You cannot remove the organization's last remaining owner. Transfer ownership first by promoting another member to owner.

:::tip
If your goal is simply to reduce what a person can do — not to cut them off entirely — consider changing their role or adjusting an individual resource grant instead of removing them from the organization.
:::

## Leaving an organization

Any member can leave an organization they belong to, from the organization's **Members** page or its settings.

- When you leave, you give up your role and lose the access that came with your membership, exactly as if an owner had removed you.
- You **cannot leave** an organization if you are its only owner. Promote another member to owner first, then leave.
- You **cannot leave your personal organization**. Every user is automatically the owner of their own personal organization (their personal workspace), and it stays with the account.

## Where this fits

```text
Organization
├── Members         ← roles: owner / admin / member
│   └── Base permission applies to plain members (none | read | admin)
├── Teams           ← flat groups of members; granted access flows to all members
└── Resources       ← experiments, protocols, macros, workbooks (org-owned)
        └── Grants  ← per-user / per-team / per-org; always override base permission
```

For granting and revoking access to individual resources and sharing with teams, see [Sharing resources](./008-sharing-resources.md). To bring people in — including those who do not yet have an account — see [Inviting members and handling join requests](./006-inviting-and-join-requests.md).

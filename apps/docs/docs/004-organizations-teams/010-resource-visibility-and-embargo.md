# Resource visibility and embargo

Every resource in openJII has a **visibility**: it is either **public** or **private**. Visibility controls who can see a resource without holding an explicit grant, and it works the same way for every resource type an organization can own: experiments, protocols, macros, workbooks, and devices.

This page explains how visibility behaves, why it can only move in one direction, and how the experiment **embargo** lets you keep an experiment private for a fixed period before it is published automatically.

## What visibility means

A resource's owning organization always controls it, and its owners and admins always have full access regardless of visibility. Visibility governs everyone else:

* **Private** — the resource is visible only to people who have access to it: the organization's owners and admins, plain members of the organization (subject to the organization's base permission), and anyone who holds an explicit grant on the resource. Nobody else can see it or discover it.
* **Public** — anyone can read the resource. A public resource is discoverable and readable by any user, even one who is not a member of the owning organization and holds no grant. Read-only access to a public resource is the last step in [access precedence](./011-access-precedence.md): if no role grants access but the resource is public and the action is a read, the action is allowed.

Visibility only ever affects **read** access. Editing, managing, and sharing a resource always require a role on it (owner or admin), no matter whether it is public or private. Making a resource public does not give the world the ability to change it; it only lets the world see it.

## New resources default to public

When you create a resource, it is **public by default**. openJII is built around open plant science, so the default is to make work discoverable. If you are not ready to share a resource, set it to private when you create it (for experiments, see [Create an experiment](../003-data-platform/002-web-platform/0013-create-add-experiment.md)), or apply an embargo so it publishes itself later.

## Visibility is monotonic

Visibility can only move in one direction: **private → public**.

* You **can** publish a private resource by making it public.
* You **can never** make a public resource private again.

| From | To | Allowed? |
| :--- | :--- | :---: |
| Private | Public | ✓ |
| Public | Private | ✗ |
| Private | Private (unchanged) | ✓ |
| Public | Public (unchanged) | ✓ |

This rule is enforced by the backend, not just hidden in the interface. Once a resource is public, the control to make it private is gone.

### Why visibility is one-way

Published data stays published. Once a resource has been public, other people may have read it, cited it, linked to it, or built on it. Quietly pulling it back to private would break those references and undermine trust in what openJII publishes. The monotonic rule guarantees that anything you publish remains available, and it makes "publish" a deliberate, irreversible step rather than something you can flip back and forth. If you are unsure, keep the resource private until you are ready to commit.

> Treat publishing as permanent. If you want time to finish work before it becomes public, keep the resource private — and for experiments, use an embargo to schedule the release rather than relying on remembering to publish manually.

## Experiment embargo

An **embargo** is an openJII feature for experiments. It lets you keep an experiment **private** while you collect and prepare data, then have openJII **publish it automatically** on a date you choose.

An embargoed experiment is a private experiment with an **embargo date** attached:

* While the embargo is active, the experiment behaves exactly like any other private experiment — it is hidden from people who do not have access to it, and it does not appear to non-members.
* On the first daily run **on or after** the embargo date, openJII automatically makes the experiment **public**.
* The default embargo is **90 days from the experiment's creation**. You can set a different date when you create the experiment or while it is still private.

### How automatic publishing works

A scheduled job runs once per day at **midnight UTC**. On each run it finds every private experiment whose embargo date has been reached and publishes it (sets its visibility to public). Because the job runs daily, an experiment is published on the first midnight-UTC run on or after its embargo date — not necessarily at the exact moment the date arrives.

```text
Experiment created (private, embargo = +90 days)
        │
        ▼
   ┌─────────────┐   private, hidden from non-members
   │  embargoed  │   owners/admins/grantees still have access
   └─────────────┘
        │
        │  daily job at 00:00 UTC checks: embargo date reached?
        ▼
   ┌─────────────┐
   │   public    │   automatically published, readable by anyone
   └─────────────┘
```

Publishing via embargo is the same private → public transition described above, so it obeys the monotonic rule: the embargo can only flip an experiment from private to public, never the other way. Once an embargoed experiment publishes, it stays public. There is no automatic un-publish.

### Embargo and access

The embargo only changes the experiment's **visibility**. It does not change any roles or grants. While the experiment is embargoed:

* Owners and admins of the owning organization keep full access.
* Plain members of the organization have whatever the organization's base permission grants them.
* Anyone with an explicit grant on the experiment keeps that access.
* Everyone else sees nothing, because the experiment is still private. \*

When the embargo lapses and the experiment becomes public, read access opens up to everyone, while edit, manage, and share still require a role on the experiment.

`*` This is why a private, embargoed experiment is hidden in listings for users who are not members and hold no grant.

## See also

* [Access precedence](./011-access-precedence.md) — how openJII decides whether an action is allowed, with public-resource read access as the final step.
* [Create an experiment](../003-data-platform/002-web-platform/0013-create-add-experiment.md) — set visibility and an embargo date when you create an experiment.
* [Roles and rights](../003-data-platform/002-web-platform/0020-roles.md) — what experiment admins and members can do.

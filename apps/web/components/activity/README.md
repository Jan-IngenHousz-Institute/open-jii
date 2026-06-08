# Activity hub — follow-up work

This branch is the landing spot for the **real, backend-backed** activity
hub and the related CMS-fed "What's new" panel. The mergeable chrome-refresh
branch (`feat/ojd-1510-chrome-refresh`) ships an honest but limited version;
the items below are deliberately deferred here.

## Current state (on the mergeable branch)

The topbar bell ([`activity-popover.tsx`](../navigation/navigation-topbar/activity-popover.tsx))
reads from [`activity-context.tsx`](./activity-context.tsx), an **in-memory**
React store. The only producer is [`use-track-exports.tsx`](./use-track-exports.tsx),
called inside the data-export modal's `ExportListStep`: it mirrors the modal's
`useListExports` poll into the store. So today the bell:

- tracks **data exports only**,
- updates **only while the export modal is open** (the modal is the only poller),
- is **not persisted** — entries are lost on reload.

`ActivityJobKind` already includes `ambyte_processing` and `metadata_reprocess`,
but nothing produces them yet.

## To build here (OJD-1506)

1. **Backend activity table + endpoint** — persist jobs server-side and expose
   a `GET /activity` feed with per-user unread state. Replace the in-memory
   `ActivityProvider` with a query/subscription against it.
2. **App-wide poller (or push)** — surface updates everywhere, not just inside
   the export modal, and have them survive reloads.
3. **Ambyte upload + metadata-reprocess producers** — emit start/finish events
   for the two `ActivityJobKind`s that currently have no producer. The bell's
   empty-state copy can then mention uploads again.
4. **"Open all activity" page** — a full history view; re-add the footer link in
   `activity-popover.tsx` (removed on the mergeable branch because it was a
   dead `href="#"`).

## Related: What's new from CMS (OJD-1507)

[`whats-new-entries.ts`](../whats-new/whats-new-entries.ts) is a curated static
list (`WHATS_NEW_ENTRIES`). Source it from Contentful instead, and keep the
unread indicator in [`whats-new-context.tsx`](../whats-new/whats-new-context.tsx)
keyed off the latest published entry per user (it already persists last-seen in
`localStorage`).

import { z } from "zod";

/**
 * The caller's effective capabilities on a single resource, as resolved by the
 * backend's `can()` (owning-org role → user grant → team grant → org grant →
 * public-read).
 *
 * Exists so the web app gates UI on *capability* rather than ownership: gating on
 * `createdBy === session.user.id` made an "admin"-granted collaborator read-only in
 * the UI even though `can(update)` allowed it. Because these are computed
 * server-side, precedence is never re-implemented client-side.
 *
 * A *rendering* signal, not enforcement — every mutating route stays guarded on its
 * own. `read` is absent: holding the detail response already implies it.
 */
export const zResourceCapabilities = z.object({
  /**
   * Add or alter the resource's data (`can(contribute)`) — for an experiment,
   * measurements and annotations. Distinct from `canUpdate`: a collaborator
   * invited to an experiment contributes data to it without editing the
   * experiment itself. Only experiments gate anything on this today.
   */
  canContribute: z.boolean(),
  /** Edit the resource's content and settings (`can(update)`). */
  canUpdate: z.boolean(),
  /** Manage the resource, including publishing it (`can(manage)`). */
  canManage: z.boolean(),
  /** Create, change and revoke grants on the resource (`can(share)`). */
  canShare: z.boolean(),
  /**
   * Give up the caller's own access (`DELETE …/collaborators/me`). Unlike the
   * flags above this is not a `can()` action: it is true exactly when the
   * caller holds a **direct user grant** on the resource — the thing the leave
   * endpoint deletes. False for access held via org role, an organization
   * grant, or public visibility (there is no row of one's own to give up).
   * The attempt may still be refused server-side when the caller is the
   * resource's last admin.
   */
  canLeave: z.boolean(),
});

export type ResourceCapabilities = z.infer<typeof zResourceCapabilities>;

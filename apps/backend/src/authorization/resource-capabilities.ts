import type { ResourceCapabilities } from "@repo/api/domains/authorization/capabilities.schema";
import type { ResourceType } from "@repo/database";

import type { AuthorizationService } from "./authorization.service";

/**
 * Resolve the caller's effective capabilities on one resource, for the detail
 * responses that drive capability-gated UI.
 *
 * Every boolean comes from the same `can()` the guards use, so the web app never
 * re-implements precedence. This is a rendering signal only: the mutating routes
 * stay guarded independently.
 *
 * Each boolean is a separate precedence walk, run concurrently. If that ever shows
 * up in profiles, the fix is a batched `capabilities()` method *inside*
 * `AuthorizationService`, not a second precedence implementation out here.
 */
export async function resolveResourceCapabilities(
  authz: AuthorizationService,
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
): Promise<ResourceCapabilities> {
  const [contribute, update, manage, share, hasOwnGrant] = await Promise.all([
    authz.can(userId, { resourceType, resourceId, action: "contribute" }),
    authz.can(userId, { resourceType, resourceId, action: "update" }),
    authz.can(userId, { resourceType, resourceId, action: "manage" }),
    authz.can(userId, { resourceType, resourceId, action: "share" }),
    authz.hasDirectUserGrant(userId, resourceType, resourceId),
  ]);

  return {
    canContribute: contribute.allow,
    canUpdate: update.allow,
    canManage: manage.allow,
    canShare: share.allow,
    // Not a can() action: whether a direct user grant of the caller's own
    // exists to give up. See the schema for the exact semantics.
    canLeave: hasOwnGrant,
    // `manage` plus authority over the owning organization, mirroring the server
    // gate. Asked only when it can be true, since it costs another two queries —
    // and devices have no transfer route to enable.
    canTransfer:
      resourceType !== "device" &&
      manage.allow &&
      (await authz.canTransferOut(userId, manage.organizationId)),
  };
}

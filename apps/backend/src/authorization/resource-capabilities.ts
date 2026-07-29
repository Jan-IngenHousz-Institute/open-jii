import type { ResourceCapabilities } from "@repo/api/domains/authorization/capabilities.schema";
import type { ResourceType } from "@repo/database";

import type { AuthorizationService } from "./authorization.service";

/**
 * Resolve the caller's effective capabilities on one resource, for the detail
 * responses that drive capability-gated UI.
 *
 * Every boolean comes from the same `can()` the guards use, so the web app never
 * re-implements precedence — it only renders what the server already decided.
 * This is a rendering signal: the mutating routes remain guarded independently,
 * so a client that ignores these flags is still refused.
 *
 * Each boolean is one resolution of the same ownership + grant tiers. They run
 * concurrently, so the added latency is roughly one query round rather than one
 * per action, and `can()` is left untouched — deliberately, since
 * reworking the precedence walk to evaluate several actions in one pass would
 * mean editing the most security-sensitive function in the codebase for a
 * detail-view optimization. If this shows up in profiles, the fix is a batched
 * `capabilities()` method *inside* `AuthorizationService` (one walk, many
 * actions), not a second precedence implementation out here.
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
  };
}

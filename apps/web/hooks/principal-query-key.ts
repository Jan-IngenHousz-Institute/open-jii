import type { QueryKey } from "@tanstack/react-query";

/**
 * Authorization-sensitive queries need one cache entry per principal: the
 * QueryClient is module-level and survives a client-side sign-out → sign-in, so
 * a key built from inputs alone would hand the next user the previous user's
 * cached answer as a `success` state — invitee emails, or someone else's
 * `canShare`.
 */

/** Signed-out cache segment for authorization-sensitive queries. */
export const ANONYMOUS_PRINCIPAL = "anonymous";

/**
 * Scopes a query to its principal. The segment stays last so prefix invalidation
 * still works; callers must wait for session resolution before fetching.
 */
export function withPrincipal(baseKey: QueryKey, userId: string | undefined): QueryKey {
  return [...baseKey, { principal: userId ?? ANONYMOUS_PRINCIPAL }];
}

import type { QueryKey } from "@tanstack/react-query";

/**
 * Principal scoping for authorization-sensitive cache entries.
 *
 * Some queries return data whose contents depend entirely on *who is asking* —
 * the collaborators list and pending invitations are `can(share)`-gated, an
 * experiment-access response carries the caller's own capabilities, and
 * organization search is scoped to the caller's own memberships. The app's
 * QueryClient is module-level and survives a client-side sign-out → sign-in, so
 * keying those queries by their inputs alone would let a second user on the same
 * browser read the first user's cached answer as a `success` state while their own
 * request is still in flight — long enough to render one user's invitee emails, or
 * to act on a `canShare` that is not theirs.
 *
 * Appending the principal makes the two users' entries distinct cache entries, so
 * a new principal starts from `pending` (no data) rather than from someone else's
 * answer. The principal segment goes *last*, keeping the oRPC-generated key as a
 * prefix, so `invalidateQueries` against the plain key still matches every
 * principal's entry.
 *
 * Scoping the key is only half of it: a caller must also not fetch until the
 * session has resolved, or the answer for a signed-in user lands in the anonymous
 * bucket. Hooks do that by gating on `useSession().isPending`.
 */

/**
 * Principal segment for a signed-out caller. Only ever holds data fetched while
 * genuinely signed out, which the API answers on its own (401/403/public-only) —
 * it can never carry one signed-in user's data into another's session.
 */
export const ANONYMOUS_PRINCIPAL = "anonymous";

/** The cache-key segment identifying whoever is asking. */
export function principalSegment(userId: string | undefined): string {
  return userId ?? ANONYMOUS_PRINCIPAL;
}

/** Append the asking principal to an oRPC-generated query key. */
export function withPrincipal(baseKey: QueryKey, userId: string | undefined): QueryKey {
  return [...baseKey, { principal: principalSegment(userId) }];
}

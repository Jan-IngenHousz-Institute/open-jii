/**
 * What counts as a live invitation.
 *
 * Better Auth refuses an expired invitation but never retires its stored `pending`
 * status, so status alone is not the answer: a past-due row keeps rendering as
 * pending, keeps counting toward the Invited tab, and keeps its address in the
 * "already invited" set — so re-inviting someone after 48 hours looks impossible
 * until the dead row is cancelled by hand.
 */

export interface InvitationLiveness {
  status: string;
  /** Better Auth returns this as a `Date` through its client. */
  expiresAt: Date | string;
}

export function isLiveInvitation(
  invitation: InvitationLiveness,
  now: number = Date.now(),
): boolean {
  if (invitation.status !== "pending") return false;

  const expiresAt = new Date(invitation.expiresAt).getTime();
  // An unparseable expiry is not treated as expired: dropping the row would hide an
  // invitation that may well still be live, and the server decides either way.
  return Number.isNaN(expiresAt) || expiresAt > now;
}

/**
 * The live invitations of a list, in the order they came back. Accepts `null`
 * because Better Auth's client types its list response as nullable.
 */
export function liveInvitations<T extends InvitationLiveness>(
  invitations: T[] | null | undefined,
  now?: number,
): T[] {
  return (invitations ?? []).filter((invitation) => isLiveInvitation(invitation, now));
}

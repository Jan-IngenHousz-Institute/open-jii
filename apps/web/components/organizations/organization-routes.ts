/**
 * Organization routes are id-based like every other platform surface, an accepted
 * divergence from the slug-based links the reference documentation describes: a
 * slug can be renamed, and a renamed slug would break every link that used it.
 */

/**
 * The organizations listing. The caller's memberships and the public directory
 * are one route filtered by `?filter=all`, the same query the experiments and
 * macros listings use — not two routes with a tab strip over them.
 */
export function organizationsPath(locale: string): string {
  return `/${locale}/platform/organizations`;
}

export function newOrganizationPath(locale: string): string {
  return `/${locale}/platform/organizations/new`;
}

export function organizationPath(locale: string, organizationId: string): string {
  return `/${locale}/platform/organizations/${organizationId}`;
}

export function organizationMembersPath(locale: string, organizationId: string): string {
  return `${organizationPath(locale, organizationId)}/members`;
}

export function organizationTeamsPath(locale: string, organizationId: string): string {
  return `${organizationPath(locale, organizationId)}/teams`;
}

export function organizationTeamPath(
  locale: string,
  organizationId: string,
  teamId: string,
): string {
  return `${organizationTeamsPath(locale, organizationId)}/${teamId}`;
}

export function organizationSettingsPath(locale: string, organizationId: string): string {
  return `${organizationPath(locale, organizationId)}/settings`;
}

/**
 * Where an invitation email lands. Unprefixed by locale on purpose: the mail is
 * composed without a locale in scope, and the proxy redirects to the negotiated
 * one — the same shape as every other transactional link.
 */
export function acceptInvitationPath(invitationId: string): string {
  return `/platform/accept-invitation/${invitationId}`;
}

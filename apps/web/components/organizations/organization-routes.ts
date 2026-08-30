/**
 * Organization routes are id-based like every other platform surface, an accepted
 * divergence from the slug-based links the reference documentation describes: a
 * slug can be renamed, and a renamed slug would break every link that used it.
 */

export function organizationsPath(locale: string): string {
  return `/${locale}/platform/organizations`;
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

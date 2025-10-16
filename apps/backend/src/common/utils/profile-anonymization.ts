import type { SQL } from "@repo/database";
import { sql, profiles, users, organizations } from "@repo/database";

/**
 * Creates SQL CASE expressions to anonymize profile fields when activated = false
 * Returns the actual values when activated = true, and generic placeholders when activated = false
 */
export const getAnonymizedFirstName = (): SQL<string> =>
  sql`CASE WHEN ${profiles.activated} = true THEN ${profiles.firstName} ELSE 'Unknown' END`;

export const getAnonymizedLastName = (): SQL<string> =>
  sql`CASE WHEN ${profiles.activated} = true THEN ${profiles.lastName} ELSE 'User' END`;

export const getAnonymizedBio = (): SQL<string | null> =>
  sql`CASE WHEN ${profiles.activated} = true THEN ${profiles.bio} ELSE NULL END`;

export const getAnonymizedAvatarUrl = (): SQL<string | null> =>
  sql`CASE WHEN ${profiles.activated} = true THEN ${profiles.avatarUrl} ELSE NULL END`;

export const getAnonymizedEmail = (): SQL<string | null> =>
  sql`CASE WHEN ${profiles.activated} = true THEN ${users.email} ELSE NULL END`;

export const getAnonymizedOrganizationName = (): SQL<string | null> =>
  sql`CASE WHEN ${profiles.activated} = true THEN ${organizations.name} ELSE NULL END`;

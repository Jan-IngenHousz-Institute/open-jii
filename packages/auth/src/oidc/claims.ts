export interface OrganizationClaim {
  id: string;
  slug: string;
  name: string;
  role: string;
}

export async function getOidcClaims(
  user: { id: string; name?: string | null; email: string; registered?: unknown },
  scopes: string[],
  loadMemberships: (userId: string) => Promise<OrganizationClaim[]>,
) {
  return {
    orgs: await loadMemberships(user.id),
    registered: user.registered === true,
    ...(scopes.includes("profile")
      ? { name: user.name?.trim() ? user.name.trim() : user.email }
      : {}),
  };
}

export const oidcAdvertisedMetadata = {
  claims_supported: [
    "sub",
    "iss",
    "aud",
    "exp",
    "iat",
    "sid",
    "scope",
    "azp",
    "email",
    "email_verified",
    "name",
    "picture",
    "family_name",
    "given_name",
    "orgs",
    "registered",
  ],
};

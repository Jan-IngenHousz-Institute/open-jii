export interface ORCIDTokens extends Record<string, unknown> {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  name: string;
  orcid: string;
}

export interface ORCIDProfile extends Record<string, unknown> {
  "orcid-identifier"?: {
    uri: string;
    path: string;
    host: string;
  };
  person?: {
    name?: {
      "given-names": { value: string };
      "family-name": { value: string };
      "credit-name": null | { value: string };
    };
    emails?: {
      email: {
        email: string;
      }[];
    };
  };
}

interface OrcidProviderConfig {
  clientId: string;
  clientSecret: string;
  environment?: "production" | "sandbox";
}

/**
 * ORCID OAuth provider for Better Auth
 *
 * @example
 * ```ts
 * import { orcidProvider } from "@repo/auth/providers/orcid"
 *
 * orcidProvider({
 *   clientId: process.env.AUTH_ORCID_ID,
 *   clientSecret: process.env.AUTH_ORCID_SECRET,
 *   environment: "production",
 * })
 * ```
 *
 * Resources:
 * - [ORCID API Tutorial](https://info.orcid.org/documentation/api-tutorials/api-tutorial-get-and-authenticated-orcid-id/)
 * - [ORCID OAuth Documentation](https://info.orcid.org/documentation/integration-and-api-faq/)
 */
export function orcidProvider(config: OrcidProviderConfig) {
  const isProduction = config.environment !== "sandbox";
  const baseUrl = isProduction ? "https://orcid.org" : "https://sandbox.orcid.org";

  return {
    id: "orcid",
    name: "ORCID",
    type: "oauth2" as const,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: `${baseUrl}/oauth/authorize`,
    tokenUrl: `${baseUrl}/oauth/token`,
    userInfoUrl: "https://pub.orcid.org/v3.0/",
    scope: ["/authenticate"],
    mapProfileToUser: (profile: ORCIDProfile & { orcid?: string }) => {
      // Extract names from ORCID person data
      const givenName = profile.person?.name?.["given-names"]?.value ?? "";
      const familyName = profile.person?.name?.["family-name"]?.value ?? "";
      const fullName = `${givenName} ${familyName}`.trim();

      // Extract ORCID iD from the API response
      const orcidIdentifier = profile["orcid-identifier"];
      const orcidId = orcidIdentifier?.uri ?? orcidIdentifier?.path ?? profile.orcid ?? "";

      const orcidIdParts = orcidId ? orcidId.split("/") : [];
      const orcidPath = orcidIdParts[orcidIdParts.length - 1];

      // Use credit name, constructed full name, or fallback to ORCID iD
      const creditName = profile.person?.name?.["credit-name"]?.value;
      const nonEmptyFullName = fullName || undefined;
      const displayName = creditName ?? nonEmptyFullName ?? orcidPath;

      const email = profile.person?.emails?.email[0]?.email ?? "";

      return {
        id: orcidPath || orcidId,
        name: displayName,
        email,
        image: null,
        emailVerified: true,
        registered: false,
      };
    },
  };
}

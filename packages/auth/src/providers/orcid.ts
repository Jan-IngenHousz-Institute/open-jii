interface ORCIDRecordResponse {
  record: {
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
        email?: {
          email: string;
          verified: boolean;
          visibility: string;
          primary: boolean;
        }[];
      };
    };
  };
}

interface OrcidProviderConfig {
  clientId: string;
  clientSecret: string;
  environment?: "production" | "sandbox";
  /**
   * Additional scopes to request beyond the default /authenticate scope
   * @example ["/read-limited"]
   */
  scopes?: string[];
  /**
   * Custom redirect URI (optional)
   */
  redirectURI?: string;
  /**
   * Disable automatic user registration on sign-in
   */
  disableImplicitSignUp?: boolean;
  /**
   * Override user info on every sign-in
   */
  overrideUserInfo?: boolean;
}

/**
 * ORCID OAuth provider for Better Auth using the Generic OAuth Plugin
 *
 * @example
 * ```ts
 * import { betterAuth } from "better-auth"
 * import { genericOAuth } from "better-auth/plugins"
 * import { orcidProvider } from "@repo/auth/providers/orcid"
 *
 * export const auth = betterAuth({
 *   plugins: [
 *     genericOAuth({
 *       config: [
 *         orcidProvider({
 *           clientId: process.env.AUTH_ORCID_ID!,
 *           clientSecret: process.env.AUTH_ORCID_SECRET!,
 *           environment: "production", // or "sandbox"
 *         }),
 *       ],
 *     }),
 *   ],
 * })
 * ```
 *
 * Resources:
 * - [ORCID API Tutorial](https://info.orcid.org/documentation/api-tutorials/api-tutorial-get-and-authenticated-orcid-id/)
 * - [ORCID OAuth Documentation](https://info.orcid.org/documentation/integration-and-api-faq/)
 * - [Better Auth Generic OAuth](https://www.better-auth.com/docs/plugins/generic-oauth)
 */
export function orcidProvider(config: OrcidProviderConfig) {
  const isProduction = config.environment !== "sandbox";
  const baseUrl = isProduction ? "https://orcid.org" : "https://sandbox.orcid.org";

  return {
    providerId: "orcid",
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: `${baseUrl}/oauth/authorize`,
    tokenUrl: `${baseUrl}/oauth/token`,
    scopes: config.scopes ?? ["openid", "/authenticate"],
    redirectURI: config.redirectURI,
    disableImplicitSignUp: config.disableImplicitSignUp,
    overrideUserInfo: config.overrideUserInfo,
    // Custom user info fetching from ORCID API
    getUserInfo: async (tokens: { accessToken?: string; raw?: Record<string, unknown> }) => {
      // ORCID returns the ORCID iD in the token response
      const orcidId = (tokens.raw as { orcid?: string } | undefined)?.orcid ?? "";

      if (!orcidId) {
        throw new Error("ORCID ID not found in token response");
      }

      if (!tokens.accessToken) {
        throw new Error("Access token not found");
      }

      let email = "";
      let emailVerified = false;

      // Fetch user profile from ORCID public API
      const publicApiUrl = isProduction
        ? "https://pub.orcid.org/v3.0"
        : "https://pub.sandbox.orcid.org/v3.0";

      // Use /record endpoint to ensure we get email address if public
      const response = await fetch(`${publicApiUrl}/${orcidId}/record`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ORCID record: ${response.statusText}`);
      }

      const data = (await response.json()) as ORCIDRecordResponse;
      const person = data.record.person;

      // Extract names from ORCID person data
      const givenName = person?.name?.["given-names"]?.value ?? "";
      const familyName = person?.name?.["family-name"]?.value ?? "";
      const fullName = `${givenName} ${familyName}`.trim();

      // Use credit name, constructed full name, or fallback to ORCID iD
      const creditName = person?.name?.["credit-name"]?.value;
      const nonEmptyFullName = fullName || undefined;
      const displayName = creditName ?? nonEmptyFullName ?? orcidId;

      // Fallback: Extract email from record (public emails only)
      if (!email && person?.emails?.email?.length) {
        // Try to find a primary email, or take the first one
        const publicEmail = person.emails.email.find((e) => e.primary) ?? person.emails.email[0];

        email = publicEmail.email;
        emailVerified = publicEmail.verified;
      }

      // Final fallback: If no email is available, use the ORCID ID
      if (!email) {
        email = orcidId;
        emailVerified = true;
      }

      return {
        id: orcidId,
        name: displayName,
        email,
        image: undefined,
        emailVerified,
      };
    },
  };
}

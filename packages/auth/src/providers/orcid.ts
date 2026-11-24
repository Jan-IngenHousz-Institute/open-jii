interface ORCIDRecordResponse {
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
    // ORCID's discovery document advertises no code_challenge_methods_supported.
    pkce: false,
    redirectURI: config.redirectURI,
    disableImplicitSignUp: config.disableImplicitSignUp,
    overrideUserInfo: config.overrideUserInfo,
    // Custom user info fetching from ORCID API
    getUserInfo: async (tokens: { accessToken?: string; raw?: Record<string, unknown> }) => {
      // ORCID returns the ORCID iD in the token response
      // A throw here escapes the callback as a bare 500. Null makes Better Auth answer
      // `unable_to_get_user_info` through the error URL in the state, so a connect returns to
      // Security and a sign-in to the login error page.
      const orcidId = (tokens.raw as { orcid?: string } | undefined)?.orcid ?? "";

      if (!orcidId) {
        console.warn("ORCID token response carried no iD");
        return null;
      }

      if (!tokens.accessToken) {
        console.warn("ORCID token response carried no access token");
        return null;
      }

      const publicApiUrl = isProduction
        ? "https://pub.orcid.org/v3.0"
        : "https://pub.sandbox.orcid.org/v3.0";

      // Fetch ORCID public profile
      let data: ORCIDRecordResponse;
      try {
        const response = await fetch(`${publicApiUrl}/${orcidId}`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });

        if (!response.ok) {
          console.warn("Failed to fetch the ORCID record", { status: response.status });
          return null;
        }

        data = (await response.json()) as ORCIDRecordResponse;
      } catch (error) {
        console.warn("Failed to fetch the ORCID record", error);
        return null;
      }
      const person = data.person;

      // Extract names from ORCID person data
      const givenName = person?.name?.["given-names"]?.value ?? "";
      const familyName = person?.name?.["family-name"]?.value ?? "";
      const fullName = `${givenName} ${familyName}`.trim();

      // Use credit name, constructed full name, or fallback to ORCID iD
      const creditName = person?.name?.["credit-name"]?.value;
      const nonEmptyFullName = fullName || undefined;
      const displayName = creditName ?? nonEmptyFullName ?? orcidId;

      // Fallback: Extract email from record (public emails only)
      let email = "";
      let emailVerified = false;

      // ORCID is a trusted provider for account linking, so Better Auth no longer
      // checks emailVerified before linking a sign-in to an account with the same
      // address. An unverified email is skipped here instead, so nobody can claim
      // an account by publishing its address on an ORCID record.
      const verifiedEmails = person?.emails?.email?.filter((e) => e.verified) ?? [];
      if (verifiedEmails.length) {
        // Try to find a primary email, or take the first one
        const publicEmail = verifiedEmails.find((e) => e.primary) ?? verifiedEmails[0];
        email = publicEmail.email;
        emailVerified = true;
      }

      // Final fallback: If no verified email is available, use the ORCID ID.
      // Mark emailVerified = false so the user is prompted to supply a real email.
      if (!email) {
        email = orcidId;
        emailVerified = false;
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

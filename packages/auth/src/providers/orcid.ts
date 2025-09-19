import type { OAuthConfig, OAuthUserConfig } from "@auth/core/providers/oauth";

export interface ORCIDProfile extends Record<string, unknown> {
  orcid_identifier: {
    uri: string;
    path: string;
    host: string;
  };
  person: {
    name: {
      "given-names": {
        value: string;
      } | null;
      "family-name": {
        value: string;
      } | null;
      "credit-name": {
        value: string;
      } | null;
    } | null;
  } | null;
}

/**
 * ORCID OAuth provider for Auth.js
 *
 * @example
 * ```ts
 * import { ORCID } from "@repo/auth/providers/orcid"
 *
 * export default NextAuth({
 *   providers: [
 *     ORCID({
 *       clientId: process.env.AUTH_ORCID_ID,
 *       clientSecret: process.env.AUTH_ORCID_SECRET,
 *     })
 *   ]
 * })
 * ```
 *
 * Resources:
 * - [ORCID API Tutorial](https://info.orcid.org/documentation/api-tutorials/api-tutorial-get-and-authenticated-orcid-id/)
 * - [ORCID OAuth Documentation](https://info.orcid.org/documentation/integration-and-api-faq/)
 */
export default function ORCID<P extends ORCIDProfile>(
  options: OAuthUserConfig<P> & {
    /**
     * Set to "sandbox" to use ORCID sandbox environment for testing
     * @default "production"
     */
    environment?: "production" | "sandbox";
  },
): OAuthConfig<P> {
  const isProduction = options.environment !== "sandbox";
  const baseUrl = isProduction ? "https://orcid.org" : "https://sandbox.orcid.org";

  return {
    id: "orcid",
    name: "ORCID",
    type: "oauth",
    issuer: baseUrl,
    authorization: {
      url: `${baseUrl}/oauth/authorize`,
      params: {
        scope: "/authenticate",
        response_type: "code",
        // Note: redirect_uri is automatically handled by Auth.js
        // It will be added as: {baseUrl}/api/auth/callback/orcid
      },
    },
    token: `${baseUrl}/oauth/token`,
    userinfo: {
      url: `${baseUrl}/v3.0/`,
      async request({ tokens }: { tokens: { access_token: string } }) {
        // ORCID requires the bearer token to access user information
        const tokensObj = tokens as { access_token: string };
        const response = await fetch(`${baseUrl}/v3.0/${tokensObj.access_token}/record`, {
          headers: {
            Authorization: `Bearer ${tokensObj.access_token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch ORCID profile: ${response.status}`);
        }

        return (await response.json()) as P;
      },
    },
    client: {
      token_endpoint_auth_method: "client_secret_post",
    },
    profile(profile: P) {
      const givenName = profile.person?.name?.["given-names"]?.value ?? "";
      const familyName = profile.person?.name?.["family-name"]?.value ?? "";
      const fullName = `${givenName} ${familyName}`.trim();

      return {
        id: profile.orcid_identifier.path,
        name:
          profile.person?.name?.["credit-name"]?.value ??
          (fullName || profile.orcid_identifier.path),
        email: null, // ORCID doesn't provide email in the basic scope
        image: null, // ORCID doesn't provide profile images
        registered: false, // Will be set properly by the auth system
        // Store the full ORCID iD for future reference
        orcid: profile.orcid_identifier.uri,
      };
    },
    options,
  };
}

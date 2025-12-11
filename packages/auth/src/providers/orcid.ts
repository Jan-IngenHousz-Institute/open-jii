import type { OAuthConfig, OAuthUserConfig } from "@auth/core/providers/oauth";

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
  preferences?: {
    locale: string;
  };
  history?: {
    "creation-method": string;
    "completion-date": { value: number };
    "submission-date": { value: number };
    "last-modified-date": { value: number };
    claimed: boolean;
    source: null;
    "deactivation-date": null;
    "verified-email": boolean;
    "verified-primary-email": boolean;
  };
  person?: {
    "last-modified-date": { value: number };
    name?: {
      "created-date": { value: number };
      "last-modified-date": { value: number };
      "given-names": { value: string };
      "family-name": { value: string };
      "credit-name": null | { value: string };
      source: null;
      visibility: string;
      path: string;
    };
    "other-names"?: {
      "last-modified-date": { value: number };
      "other-name": {
        "created-date": { value: number };
        "last-modified-date": { value: number };
        source: unknown;
        content: string;
        visibility: string;
        path: string;
        "put-code": number;
        "display-index": number;
      }[];
      path: string;
    };
    biography?: {
      "created-date": { value: number };
      "last-modified-date": { value: number };
      content: string;
      visibility: string;
      path: string;
    };
    "researcher-urls"?: unknown;
    emails?: {
      "last-modified-date": null;
      email: {
        email: string;
      }[];
      path: string;
    };
    addresses?: {
      "last-modified-date": null;
      address: unknown[];
      path: string;
    };
    keywords?: unknown;
    "external-identifiers"?: unknown;
    path: string;
  };
  "activities-summary"?: unknown;
  path: string;
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
      url: "https://orcid.org/oauth/authorize",
      params: {
        scope: "/authenticate",
        response_type: "code",
        redirect_uri: process.env.NEXT_PUBLIC_BASE_URL + "/api/auth/callback/orcid",
      },
    },
    token: {
      url: `${baseUrl}/oauth/token`,
      async request({ params }: { params: Record<string, string> }) {
        // Make the token request
        const response = await fetch(`${baseUrl}/oauth/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: new URLSearchParams(params),
        });

        if (!response.ok) {
          throw new Error(`Token request failed: ${response.status}`);
        }

        const tokens = (await response.json()) as ORCIDTokens;

        return tokens;
      },
    },
    client: {
      token_endpoint_auth_method: "client_secret_post",
    },
    userinfo: {
      url: "https://pub.orcid.org/v3.0/[ORCID]",
      async request({ tokens }: { tokens: ORCIDTokens }) {
        const res = await fetch(`https://pub.orcid.org/v3.0/${tokens.orcid}`, {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: "application/json",
          },
        });
        return (await res.json()) as ORCIDProfile;
      },
    },
    profile(profile: P) {
      // Extract names from ORCID person data
      const givenName = profile.person?.name?.["given-names"]?.value ?? "";
      const familyName = profile.person?.name?.["family-name"]?.value ?? "";
      const fullName = `${givenName} ${familyName}`.trim();

      // Extract ORCID iD from the API response
      // The ORCID API returns it in the 'orcid-identifier' field (note the hyphen)
      const orcidIdentifier = profile["orcid-identifier"];
      const orcidId = orcidIdentifier?.uri ?? orcidIdentifier?.path ?? "";

      const orcidIdParts = orcidId ? orcidId.split("/") : [];
      const orcidPath = orcidIdParts[orcidIdParts.length - 1];

      // Use credit name, constructed full name, or fallback to ORCID iD
      const creditName = profile.person?.name?.["credit-name"]?.value;
      const nonEmptyFullName = fullName || undefined;
      const displayName = creditName ?? nonEmptyFullName ?? orcidPath;

      const email = profile.person?.emails?.email[0]?.email ?? null;

      return {
        id: orcidPath || orcidId,
        name: displayName,
        email,
        image: null,
        registered: false,
        orcid: orcidId,
      };
    },
    options,
  };
}

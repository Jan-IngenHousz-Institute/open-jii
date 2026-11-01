import type { BetterAuthPlugin } from "better-auth";

interface LegacyOAuth2SignInBody {
  providerId: string;
  [key: string]: unknown;
}

function isLegacyOAuth2SignInBody(body: unknown): body is LegacyOAuth2SignInBody {
  return (
    typeof body === "object" &&
    body !== null &&
    "providerId" in body &&
    typeof body.providerId === "string"
  );
}

/**
 * Serves the `/sign-in/oauth2` route that Better Auth removed in 1.7 by rewriting it to
 * `/sign-in/social`, so installed mobile builds that still call `signIn.oauth2` keep signing in
 * with ORCID. Remove once the oldest supported mobile build signs in through `signIn.social`.
 */
export function legacyOAuth2SignIn() {
  return {
    id: "legacy-oauth2-sign-in",
    async onRequest(request, ctx) {
      const basePath = ctx.options.basePath ?? "/api/auth";
      const url = new URL(request.url);
      const isLegacySignIn =
        request.method === "POST" && url.pathname === `${basePath}/sign-in/oauth2`;
      if (!isLegacySignIn) {
        return;
      }

      const body: unknown = await request
        .clone()
        .json()
        .catch(() => null);
      if (!isLegacyOAuth2SignInBody(body)) {
        return;
      }

      const { providerId, ...rest } = body;
      url.pathname = `${basePath}/sign-in/social`;
      const headers = new Headers(request.headers);
      headers.delete("content-length");

      return {
        request: new Request(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ ...rest, provider: providerId }),
        }),
      };
    },
  } satisfies BetterAuthPlugin;
}

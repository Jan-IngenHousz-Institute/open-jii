import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { genericOAuth } from "better-auth/plugins";
import { describe, expect, it } from "vitest";

import { legacyOAuth2SignIn } from "./legacy-oauth2-sign-in";
import { orcidProvider } from "./orcid";

const BASE_URL = "http://localhost:3020";
const BASE_PATH = "/api/v1/auth";

const auth = betterAuth({
  baseURL: BASE_URL,
  basePath: BASE_PATH,
  secret: "legacy-oauth2-sign-in-test-secret-0123456789",
  database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
  plugins: [
    genericOAuth({
      config: [
        orcidProvider({ clientId: "orcid-client", clientSecret: "s", environment: "sandbox" }),
      ],
    }),
    legacyOAuth2SignIn(),
  ],
});

function post(path: string, body: Record<string, unknown>) {
  return auth.handler(
    new Request(`${BASE_URL}${BASE_PATH}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify(body),
    }),
  );
}

function isRedirectBody(body: unknown): body is { redirect: true; url: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "redirect" in body &&
    body.redirect === true &&
    "url" in body &&
    typeof body.url === "string"
  );
}

async function authorizationUrl(response: Response) {
  expect(response.status).toBe(200);
  const body: unknown = await response.json();
  if (!isRedirectBody(body)) {
    throw new Error(`Expected a redirect body, got ${JSON.stringify(body)}`);
  }
  return new URL(body.url);
}

describe("legacyOAuth2SignIn", () => {
  it("answers the removed /sign-in/oauth2 route the way /sign-in/social does", async () => {
    const callbackURL = `${BASE_URL}/platform`;

    const legacy = await authorizationUrl(
      await post("/sign-in/oauth2", { providerId: "orcid", callbackURL }),
    );
    const social = await authorizationUrl(
      await post("/sign-in/social", { provider: "orcid", callbackURL }),
    );

    expect(legacy.origin + legacy.pathname).toBe("https://sandbox.orcid.org/oauth/authorize");
    expect(legacy.origin + legacy.pathname).toBe(social.origin + social.pathname);
    expect(legacy.searchParams.get("redirect_uri")).toBe(`${BASE_URL}${BASE_PATH}/callback/orcid`);
    expect(legacy.searchParams.get("redirect_uri")).toBe(social.searchParams.get("redirect_uri"));
    expect(legacy.searchParams.has("code_challenge")).toBe(false);
  });

  it("leaves a body without a providerId to the router, which has no such route", async () => {
    const response = await post("/sign-in/oauth2", { provider: "orcid" });

    expect(response.status).toBe(404);
  });
});

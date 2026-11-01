import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { jwt } from "better-auth/plugins";
import { describe, expect, it } from "vitest";

import { oidcAdvertisedMetadata } from "./claims";

const standardClaims = [
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
];

function discovery(advertisedMetadata?: { claims_supported: string[] }) {
  const auth = betterAuth({
    baseURL: "http://localhost:3020",
    basePath: "/api/v1/auth",
    secret: "oidc-discovery-test-secret-at-least-32-characters",
    database: memoryAdapter({}),
    plugins: [
      jwt(),
      oauthProvider({
        loginPage: "http://localhost:3000/login",
        consentPage: "http://localhost:3000/consent",
        scopes: ["openid", "profile", "email", "offline_access"],
        advertisedMetadata,
        silenceWarnings: { oauthAuthServerConfig: true },
      }),
    ],
  });
  return auth.api.getOpenIdConfig();
}

describe("OIDC discovery claims", () => {
  it("preserves every installed provider standard claim and advertises orgs and registered", async () => {
    const standard = await discovery();
    const configured = await discovery(oidcAdvertisedMetadata);
    expect(standard.claims_supported).toEqual(standardClaims);
    expect(configured).toEqual({
      ...standard,
      claims_supported: [...standardClaims, "orgs", "registered"],
    });
  });
});

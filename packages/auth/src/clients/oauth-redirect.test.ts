import { describe, expect, it } from "vitest";

import { isOAuthRedirect } from "./oauth-redirect";

describe("isOAuthRedirect", () => {
  it("recognizes a provider continuation so local navigation does not race it", () => {
    expect(
      isOAuthRedirect({ redirect: true, url: "https://client.example/callback?code=abc" }),
    ).toBe(true);
  });
  it.each([
    null,
    undefined,
    {},
    { user: { id: "a" } },
    { redirect: false, url: "https://example.org" },
    { redirect: true },
  ])("keeps normal sign-in navigation for %j", (data) => {
    expect(isOAuthRedirect(data)).toBe(false);
  });
});

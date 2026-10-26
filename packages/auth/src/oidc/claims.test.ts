import { describe, expect, it, vi } from "vitest";

import { getOidcClaims } from "./claims";

const user = { id: "user-a", name: "Alice", email: "alice@example.org", registered: true };

describe("OIDC claims", () => {
  it("loads only the authenticated user's current memberships with each organization's role", async () => {
    const memberships = [
      { id: "org-a", slug: "institute", name: "Institute", role: "member" },
      { id: "org-b", slug: "personal-alice", name: "Alice", role: "owner" },
    ];
    const load = vi.fn().mockResolvedValue(memberships);
    expect(await getOidcClaims(user, ["openid", "profile"], load)).toEqual({
      orgs: memberships,
      registered: true,
      name: "Alice",
    });
    expect(load).toHaveBeenCalledExactlyOnceWith("user-a");
  });

  it("represents a user with no memberships and incomplete onboarding", async () => {
    expect(
      await getOidcClaims({ ...user, registered: false }, ["openid"], () => Promise.resolve([])),
    ).toEqual({ orgs: [], registered: false });
  });

  it.each([null, undefined, "", "  "])(
    "falls back to email for an absent name: %s",
    async (name) => {
      expect(
        await getOidcClaims({ ...user, name }, ["profile"], () => Promise.resolve([])),
      ).toMatchObject({
        name: user.email,
      });
    },
  );

  it("does not disclose name without the profile scope", async () => {
    expect(
      await getOidcClaims(user, ["openid", "email"], () => Promise.resolve([])),
    ).not.toHaveProperty("name");
  });

  it("reloads memberships for each token or userinfo request", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce([
        { id: "org-a", slug: "institute", name: "Institute", role: "member" },
      ])
      .mockResolvedValueOnce([]);
    expect((await getOidcClaims(user, ["openid"], load)).orgs).toHaveLength(1);
    expect((await getOidcClaims(user, ["openid"], load)).orgs).toEqual([]);
  });
});

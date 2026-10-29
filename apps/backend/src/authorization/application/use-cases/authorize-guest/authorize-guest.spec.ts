import type { GuestIdentityPort } from "../../../../users/core/ports/guest-identity.port";
import { guestRouteInventory, matchGuestRoute } from "../../../core/models/guest-route.model";
import { AuthorizeGuestUseCase } from "./authorize-guest";

const userId = "82e9a684-8c1c-4967-b940-09735bb4b7ed";

describe("guest session and undecorated route boundary", () => {
  const findIdentity = vi.fn<GuestIdentityPort["findIdentity"]>();
  const hasSession = vi.fn<GuestIdentityPort["hasSession"]>();
  const takeQuota = vi.fn<GuestIdentityPort["takeQuota"]>();
  const useCase = new AuthorizeGuestUseCase({ findIdentity, hasSession, takeQuota });
  const request = (overrides: Partial<Parameters<typeof useCase.execute>[0]> = {}) =>
    useCase.execute({
      userId,
      isAnonymous: true,
      token: "guest-token",
      method: "GET",
      path: "/api/v1/experiments",
      hasAccessRequirement: false,
      ...overrides,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    findIdentity.mockResolvedValue({ id: userId, isAnonymous: true, createdAt: new Date() });
    hasSession.mockResolvedValue(true);
  });

  it.each(guestRouteInventory)(
    "$method $path obeys its undecorated classification",
    async (route) => {
      const result = await request({
        method: route.method,
        path: route.path.replace(/\{[^}]+\}/g, userId),
      });
      expect(result.isSuccess()).toBe(route.classification === "public-list");
      expect(takeQuota).not.toHaveBeenCalled();
    },
  );

  it("does not read identity or session rows for a signed researcher session", async () => {
    expect((await request({ isAnonymous: false })).isSuccess()).toBe(true);
    expect(findIdentity).not.toHaveBeenCalled();
    expect(hasSession).not.toHaveBeenCalled();
  });

  it("delegates opted-in routes to their resource guard and denies HEAD", async () => {
    expect(
      (await request({ hasAccessRequirement: true, path: "/api/v1/macros/" + userId })).isSuccess(),
    ).toBe(true);
    expect((await request({ hasAccessRequirement: true, method: "HEAD" })).isFailure()).toBe(true);
  });

  it("rejects missing, purged and replaced guest identities and expired sessions", async () => {
    findIdentity.mockResolvedValue(null);
    expect((await request()).isFailure()).toBe(true);
    findIdentity.mockResolvedValue({ id: userId, isAnonymous: false, createdAt: new Date() });
    expect((await request()).isFailure()).toBe(true);
    findIdentity.mockResolvedValue({ id: userId, isAnonymous: true, createdAt: new Date() });
    expect((await request({ token: undefined })).isFailure()).toBe(true);
    hasSession.mockResolvedValue(false);
    expect((await request()).isFailure()).toBe(true);
  });

  it("fails closed on unclassified endpoints and malformed parameter encodings", async () => {
    expect((await request({ method: "POST", path: "/api/v1/future-write" })).isFailure()).toBe(
      true,
    );
    expect(matchGuestRoute("GET", "/api/v1/experiments/home")?.route.procedure).toBe(
      "experiments.listHomeExperiments",
    );
    expect(matchGuestRoute("GET", "/api/v1/organizations/%ZZ")).toBeNull();
  });
});

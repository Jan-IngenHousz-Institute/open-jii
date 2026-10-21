import { z } from "zod";

import { contract } from "@repo/api/contract";

import type { GuestIdentityPort } from "../../../../users/core/ports/guest-identity.port";
import { guestRouteInventory, matchGuestRoute } from "../../../core/models/guest-route.model";
import type { GuestResourcePort } from "../../../core/ports/guest-resource.port";
import { AuthorizeGuestUseCase } from "./authorize-guest";

const userId = "82e9a684-8c1c-4967-b940-09735bb4b7ed";
const targetId = "94d8b584-2d27-46fa-aa6c-8908ce13d521";
const guest = { id: userId, isAnonymous: true, createdAt: new Date() };

describe("guest route policy", () => {
  const findIdentity = vi.fn<GuestIdentityPort["findIdentity"]>();
  const hasSession = vi.fn<GuestIdentityPort["hasSession"]>();
  const takeQuota = vi.fn<GuestIdentityPort["takeQuota"]>();
  const findOwnership = vi.fn<GuestResourcePort["findOwnership"]>();
  const enabled = vi.fn<() => Promise<boolean>>();
  const useCase = new AuthorizeGuestUseCase(
    { findIdentity, hasSession, takeQuota },
    { findOwnership },
    { isEnabled: enabled },
  );
  const request = (method: string, path: string, body: unknown = {}) =>
    useCase.execute({ userId, token: "guest-token", method, path, body });

  beforeEach(() => {
    vi.clearAllMocks();
    findIdentity.mockResolvedValue(guest);
    hasSession.mockResolvedValue(true);
    takeQuota.mockResolvedValue({ allowed: true, retryAfterSeconds: 100 });
    findOwnership.mockResolvedValue({
      visibility: "public",
      organizationType: "demo",
      organizationId: userId,
    });
    enabled.mockResolvedValue(true);
  });

  it("classifies every current contract route exactly once", () => {
    const routes = z
      .record(
        z.string(),
        z.record(
          z.string(),
          z.object({
            "~orpc": z.object({ route: z.object({ method: z.string(), path: z.string() }) }),
          }),
        ),
      )
      .parse(contract);
    const actual = Object.entries(routes)
      .flatMap(([domain, procedures]) =>
        Object.entries(procedures).map(([name, procedure]) => ({
          procedure: `${domain}.${name}`,
          method: procedure["~orpc"].route.method,
          path: procedure["~orpc"].route.path,
        })),
      )
      .sort((a, b) => {
        const byPath = a.path.localeCompare(b.path);
        return byPath === 0 ? a.method.localeCompare(b.method) : byPath;
      });
    expect(
      guestRouteInventory.map(({ procedure, method, path }) => ({ procedure, method, path })),
    ).toEqual(actual);
    expect(new Set(guestRouteInventory.map(({ method, path }) => `${method} ${path}`)).size).toBe(
      actual.length,
    );
  });

  it.each(guestRouteInventory.filter(({ classification }) => classification === "deny"))(
    "$method $path is refused before resource lookup, quota or flag side effects",
    async ({ method, path }) => {
      const response = await request(method, path.replace(/\{[^}]+\}/g, targetId), {
        experimentId: targetId,
      });
      expect(response.isFailure()).toBe(true);
      if (response.isFailure()) expect(response.error.statusCode).toBe(403);
      expect(findOwnership).not.toHaveBeenCalled();
      expect(takeQuota).not.toHaveBeenCalled();
      expect(enabled).not.toHaveBeenCalled();
    },
  );

  it("denies an unclassified future endpoint and does not confuse a static path with a UUID", async () => {
    expect((await request("POST", "/api/v1/future-write")).isFailure()).toBe(true);
    expect(matchGuestRoute("GET", "/api/v1/experiments/home")?.route.procedure).toBe(
      "experiments.listHomeExperiments",
    );
  });

  it.each(["experiment", "macro", "protocol", "workbook", "organization"])(
    "reads public %s outside Demo but refuses private content despite a grant",
    async (kind) => {
      const route = guestRouteInventory.find(
        ({ resource, classification }) => resource === kind && classification === "public-resource",
      );
      expect(route).toBeDefined();
      if (!route) throw new Error("Missing public resource fixture");
      findOwnership.mockResolvedValue({
        visibility: "public",
        organizationType: "university",
        organizationId: userId,
      });
      expect(
        (await request(route.method, route.path.replace(/\{[^}]+\}/g, targetId))).isSuccess(),
      ).toBe(true);
      findOwnership.mockResolvedValue({
        visibility: "private",
        organizationType: "university",
        organizationId: userId,
      });
      expect(
        (await request(route.method, route.path.replace(/\{[^}]+\}/g, targetId))).isFailure(),
      ).toBe(true);
    },
  );

  it.each(["upload", "macro"])(
    "checks current Demo ownership, the switch and quota for %s",
    async (kind) => {
      const upload = kind === "upload";
      const path = upload ? "/api/v1/iot/upload-url" : `/api/v1/macros/${targetId}/execute`;
      const body = upload
        ? { experimentId: targetId, contentLength: 20 }
        : { data: { sample: [] } };
      expect((await request("POST", path, body)).isSuccess()).toBe(true);
      expect(takeQuota).toHaveBeenCalledWith(userId, kind);
      enabled.mockResolvedValue(false);
      expect((await request("POST", path, body)).isFailure()).toBe(true);
      enabled.mockResolvedValue(true);
      findOwnership.mockResolvedValue({
        visibility: "public",
        organizationType: "university",
        organizationId: userId,
      });
      expect((await request("POST", path, body)).isFailure()).toBe(true);
      findOwnership.mockResolvedValue({
        visibility: "public",
        organizationType: "demo",
        organizationId: userId,
      });
      takeQuota.mockResolvedValue({ allowed: false, retryAfterSeconds: 100 });
      const refused = await request("POST", path, body);
      expect(refused.isFailure()).toBe(true);
      if (refused.isFailure()) expect(refused.error.statusCode).toBe(429);
    },
  );

  it.each([undefined, 0, -1, 1.5, 1_048_577])(
    "refuses upload size %s without consuming quota",
    async (contentLength) => {
      const response = await request("POST", "/api/v1/iot/upload-url", {
        experimentId: targetId,
        contentLength,
      });
      expect(response.isFailure()).toBe(true);
      expect(takeQuota).not.toHaveBeenCalled();
    },
  );

  it("permits public reads while disabled, but never a missing or purged session", async () => {
    enabled.mockResolvedValue(false);
    expect((await request("GET", "/api/v1/experiments")).isSuccess()).toBe(true);
    hasSession.mockResolvedValue(false);
    expect((await request("GET", "/api/v1/experiments")).isFailure()).toBe(true);
    findIdentity.mockResolvedValue(null);
    expect((await request("GET", "/api/v1/experiments")).isFailure()).toBe(true);
  });

  it("permits visits only to readable resources with server-owned attribution", async () => {
    expect(
      (
        await request("POST", "/api/v1/visits", {
          resourceType: "experiment",
          resourceId: targetId,
        })
      ).isSuccess(),
    ).toBe(true);
    expect(
      (
        await request("POST", "/api/v1/visits", {
          resourceType: "experiment",
          resourceId: targetId,
          userId: targetId,
        })
      ).isFailure(),
    ).toBe(true);
    findOwnership.mockResolvedValue({
      visibility: "private",
      organizationType: "university",
      organizationId: userId,
    });
    expect(
      (
        await request("POST", "/api/v1/visits", {
          resourceType: "experiment",
          resourceId: targetId,
        })
      ).isFailure(),
    ).toBe(true);
  });

  it("leaves real researchers to existing authorization", async () => {
    findIdentity.mockResolvedValue({ ...guest, isAnonymous: false });
    expect((await request("POST", "/api/v1/experiments")).isSuccess()).toBe(true);
    expect(hasSession).not.toHaveBeenCalled();
  });
});

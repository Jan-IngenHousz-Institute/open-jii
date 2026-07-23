/* eslint-disable @typescript-eslint/unbound-method */
import type { ExecutionContext } from "@nestjs/common";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import type { AuthorizationService } from "./authorization.service";
import type { CanAccessMetadata } from "./can-access.guard";
import { CanAccessGuard } from "./can-access.guard";

describe("CanAccessGuard", () => {
  let reflector: Reflector;
  let authorizationService: AuthorizationService;
  let guard: CanAccessGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
    } as unknown as Reflector;
    authorizationService = {
      can: vi.fn(),
    } as unknown as AuthorizationService;
    guard = new CanAccessGuard(reflector, authorizationService);
  });

  function setMetadata(metadata: CanAccessMetadata | undefined) {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(metadata);
  }

  function createContext(options?: {
    userId?: string;
    params?: Record<string, string>;
    path?: string;
  }): ExecutionContext {
    const handler = vi.fn();
    const request = {
      session: options?.userId ? { user: { id: options.userId } } : null,
      params: options?.params ?? {},
      path: options?.path ?? "/test",
    };

    return {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it("allows routes without CanAccess metadata", async () => {
    setMetadata(undefined);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(authorizationService.can).not.toHaveBeenCalled();
  });

  it("fails closed when the authenticated user is missing", async () => {
    setMetadata({ resource: "experiment", action: "read" });

    await expect(
      guard.canActivate(createContext({ params: { id: crypto.randomUUID() } })),
    ).rejects.toThrow(ForbiddenException);
    expect(authorizationService.can).not.toHaveBeenCalled();
  });

  it("rejects a route that does not provide its configured resource id", async () => {
    setMetadata({ resource: "experiment", action: "manage" });

    await expect(guard.canActivate(createContext({ userId: crypto.randomUUID() }))).rejects.toThrow(
      ForbiddenException,
    );
    expect(authorizationService.can).not.toHaveBeenCalled();
  });

  it("rejects an invalid resource id before consulting authorization", async () => {
    setMetadata({ resource: "experiment", action: "read" });

    await expect(
      guard.canActivate(
        createContext({ userId: crypto.randomUUID(), params: { id: "not-a-uuid" } }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(authorizationService.can).not.toHaveBeenCalled();
  });

  it("delegates the declared resource and action to AuthorizationService", async () => {
    const userId = crypto.randomUUID();
    const resourceId = crypto.randomUUID();
    setMetadata({ resource: "experiment", action: "manage" });
    vi.mocked(authorizationService.can).mockResolvedValue({ allow: true, reason: "org-role" });

    await expect(
      guard.canActivate(createContext({ userId, params: { id: resourceId } })),
    ).resolves.toBe(true);
    expect(authorizationService.can).toHaveBeenCalledWith(userId, {
      resourceType: "experiment",
      resourceId,
      action: "manage",
    });
  });

  it("supports a custom route parameter", async () => {
    const userId = crypto.randomUUID();
    const resourceId = crypto.randomUUID();
    setMetadata({ resource: "experiment", action: "update", param: "experimentId" });
    vi.mocked(authorizationService.can).mockResolvedValue({ allow: true, reason: "org-role" });

    await expect(
      guard.canActivate(createContext({ userId, params: { experimentId: resourceId } })),
    ).resolves.toBe(true);
    expect(authorizationService.can).toHaveBeenCalledWith(userId, {
      resourceType: "experiment",
      resourceId,
      action: "update",
    });
  });

  it("maps a missing resource decision to not-found", async () => {
    setMetadata({ resource: "experiment", action: "read" });
    vi.mocked(authorizationService.can).mockResolvedValue({ allow: false, reason: "not-found" });

    await expect(
      guard.canActivate(
        createContext({ userId: crypto.randomUUID(), params: { id: crypto.randomUUID() } }),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("maps an authorization denial to forbidden", async () => {
    setMetadata({ resource: "experiment", action: "manage" });
    vi.mocked(authorizationService.can).mockResolvedValue({ allow: false, reason: "forbidden" });

    await expect(
      guard.canActivate(
        createContext({ userId: crypto.randomUUID(), params: { id: crypto.randomUUID() } }),
      ),
    ).rejects.toThrow("You cannot manage this experiment");
  });
});

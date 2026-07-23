/* eslint-disable @typescript-eslint/unbound-method */
import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";

import type { AuthorizationService } from "./authorization.service";
import { CanCreateInOrgGuard } from "./can-create-in-org.guard";

describe("CanCreateInOrgGuard", () => {
  let authorizationService: AuthorizationService;
  let guard: CanCreateInOrgGuard;

  beforeEach(() => {
    authorizationService = {
      isOrgMember: vi.fn(),
    } as unknown as AuthorizationService;
    guard = new CanCreateInOrgGuard(authorizationService);
  });

  function createContext(options?: {
    userId?: string;
    body?: Record<string, unknown>;
  }): ExecutionContext {
    const request = {
      session: options?.userId ? { user: { id: options.userId } } : null,
      body: options?.body ?? {},
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it("allows creation with no target organization (personal-org fallback)", async () => {
    await expect(guard.canActivate(createContext({ userId: crypto.randomUUID() }))).resolves.toBe(
      true,
    );
    expect(authorizationService.isOrgMember).not.toHaveBeenCalled();
  });

  it("allows creation when organizationId is an empty string", async () => {
    await expect(
      guard.canActivate(
        createContext({ userId: crypto.randomUUID(), body: { organizationId: "" } }),
      ),
    ).resolves.toBe(true);
    expect(authorizationService.isOrgMember).not.toHaveBeenCalled();
  });

  it("ignores a non-string organizationId and defers to schema validation", async () => {
    await expect(
      guard.canActivate(
        createContext({ userId: crypto.randomUUID(), body: { organizationId: 123 } }),
      ),
    ).resolves.toBe(true);
    expect(authorizationService.isOrgMember).not.toHaveBeenCalled();
  });

  it("allows a member of the target organization", async () => {
    const userId = crypto.randomUUID();
    const organizationId = crypto.randomUUID();
    vi.mocked(authorizationService.isOrgMember).mockResolvedValue(true);

    await expect(
      guard.canActivate(createContext({ userId, body: { organizationId } })),
    ).resolves.toBe(true);
    expect(authorizationService.isOrgMember).toHaveBeenCalledWith(userId, organizationId);
  });

  it("denies a caller who is not a member of the target organization", async () => {
    const userId = crypto.randomUUID();
    const organizationId = crypto.randomUUID();
    vi.mocked(authorizationService.isOrgMember).mockResolvedValue(false);

    await expect(
      guard.canActivate(createContext({ userId, body: { organizationId } })),
    ).rejects.toThrow(ForbiddenException);
    expect(authorizationService.isOrgMember).toHaveBeenCalledWith(userId, organizationId);
  });

  it("fails closed when a target organization is given but the user is missing", async () => {
    await expect(
      guard.canActivate(createContext({ body: { organizationId: crypto.randomUUID() } })),
    ).rejects.toThrow(ForbiddenException);
    expect(authorizationService.isOrgMember).not.toHaveBeenCalled();
  });
});

import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import type { AuthorizationService } from "./authorization.service";
import { RequiresPlatformRoleGuard } from "./requires-platform-role.guard";

describe("RequiresPlatformRoleGuard", () => {
  let authz: Pick<AuthorizationService, "hasPlatformRole">;
  let reflector: Pick<Reflector, "getAllAndOverride">;
  let guard: RequiresPlatformRoleGuard;
  const userId = crypto.randomUUID();

  beforeEach(() => {
    authz = { hasPlatformRole: vi.fn().mockResolvedValue(true) };
    reflector = { getAllAndOverride: vi.fn().mockReturnValue("platform_admin") };
    guard = new RequiresPlatformRoleGuard(authz as AuthorizationService, reflector as Reflector);
  });

  function createContext(options: { userId?: string; apiKey?: boolean } = {}): ExecutionContext {
    const request = {
      session: options.userId ? { user: { id: options.userId } } : null,
      headers: options.apiKey ? { "x-api-key": "key" } : {},
    };
    return {
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it("admits a holder of the route's platform role", async () => {
    await expect(guard.canActivate(createContext({ userId }))).resolves.toBe(true);
    expect(authz.hasPlatformRole).toHaveBeenCalledWith(userId, "platform_admin");
  });

  it("refuses an account without the role", async () => {
    vi.mocked(authz.hasPlatformRole).mockResolvedValue(false);
    await expect(guard.canActivate(createContext({ userId }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("refuses an API key without reading the role", async () => {
    await expect(guard.canActivate(createContext({ userId, apiKey: true }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(authz.hasPlatformRole).not.toHaveBeenCalled();
  });

  it("refuses a request with no session or a route without a declared role", async () => {
    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(ForbiddenException);
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(undefined);
    await expect(guard.canActivate(createContext({ userId }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(authz.hasPlatformRole).not.toHaveBeenCalled();
  });
});

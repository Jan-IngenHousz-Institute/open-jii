/* eslint-disable @typescript-eslint/unbound-method */
import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException, InternalServerErrorException } from "@nestjs/common";

import { AppError, failure, success } from "../common/utils/fp-utils";
import type { OrganizationAccessPort } from "../organizations/core/ports/organization-access.port";
import { CanCreateInOrgGuard } from "./can-create-in-org.guard";

describe("CanCreateInOrgGuard", () => {
  let organizations: OrganizationAccessPort;
  let guard: CanCreateInOrgGuard;

  beforeEach(() => {
    organizations = {
      findAccess: vi.fn(),
    };
    guard = new CanCreateInOrgGuard(organizations);
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
    expect(organizations.findAccess).not.toHaveBeenCalled();
  });

  it("allows creation when organizationId is an empty string", async () => {
    await expect(
      guard.canActivate(
        createContext({ userId: crypto.randomUUID(), body: { organizationId: "" } }),
      ),
    ).resolves.toBe(true);
    expect(organizations.findAccess).not.toHaveBeenCalled();
  });

  it("ignores a non-string organizationId and defers to schema validation", async () => {
    await expect(
      guard.canActivate(
        createContext({ userId: crypto.randomUUID(), body: { organizationId: 123 } }),
      ),
    ).resolves.toBe(true);
    expect(organizations.findAccess).not.toHaveBeenCalled();
  });

  it("allows a member of the target organization", async () => {
    const userId = crypto.randomUUID();
    const organizationId = crypto.randomUUID();
    vi.mocked(organizations.findAccess).mockResolvedValue(
      success({
        id: organizationId,
        slug: "lab",
        visibility: "public",
        memberRole: "member",
        type: null,
      }),
    );

    await expect(
      guard.canActivate(createContext({ userId, body: { organizationId } })),
    ).resolves.toBe(true);
    expect(organizations.findAccess).toHaveBeenCalledWith(organizationId, userId);
  });

  it("denies a caller who is not a member of the target organization", async () => {
    const userId = crypto.randomUUID();
    const organizationId = crypto.randomUUID();
    vi.mocked(organizations.findAccess).mockResolvedValue(
      success({
        id: organizationId,
        slug: "lab",
        visibility: "public",
        memberRole: null,
        type: null,
      }),
    );

    await expect(
      guard.canActivate(createContext({ userId, body: { organizationId } })),
    ).rejects.toThrow(ForbiddenException);
    expect(organizations.findAccess).toHaveBeenCalledWith(organizationId, userId);
  });

  it("fails closed when a target organization is given but the user is missing", async () => {
    await expect(
      guard.canActivate(createContext({ body: { organizationId: crypto.randomUUID() } })),
    ).rejects.toThrow(ForbiddenException);
    expect(organizations.findAccess).not.toHaveBeenCalled();
  });

  it("refuses private resources in Demo using the repository access row", async () => {
    const organizationId = crypto.randomUUID();
    vi.mocked(organizations.findAccess).mockResolvedValue(
      success({
        id: organizationId,
        slug: "demo-lab",
        visibility: "public",
        memberRole: "owner",
        type: "demo",
      }),
    );
    await expect(
      guard.canActivate(
        createContext({
          userId: crypto.randomUUID(),
          body: { organizationId, visibility: "private" },
        }),
      ),
    ).rejects.toThrow("Demo organizations can only own public resources");
  });

  it("fails closed when the repository read fails", async () => {
    vi.mocked(organizations.findAccess).mockResolvedValue(failure(AppError.internal()));
    await expect(
      guard.canActivate(
        createContext({
          userId: crypto.randomUUID(),
          body: { organizationId: crypto.randomUUID() },
        }),
      ),
    ).rejects.toThrow(InternalServerErrorException);
  });
});

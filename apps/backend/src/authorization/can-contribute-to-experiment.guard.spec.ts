/* eslint-disable @typescript-eslint/unbound-method */
import type { ExecutionContext } from "@nestjs/common";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import type { DatabaseInstance } from "@repo/database";

import type { CanContributeToExperimentMetadata } from "./can-contribute-to-experiment.guard";
import { CanContributeToExperimentGuard } from "./can-contribute-to-experiment.guard";

/**
 * Builds a drizzle-like chainable query stub whose terminal `.limit()` resolves
 * to the given rows. The guard issues
 * `db.select(...).from(...).leftJoin(...).where(...).limit(1)`.
 */
function mockDb(rows: { experimentId: string; memberId: string | null }[]): {
  db: DatabaseInstance;
  limit: ReturnType<typeof vi.fn>;
} {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  const limit = vi.fn(() => Promise.resolve(rows));
  chain.limit = limit;
  return { db: chain as unknown as DatabaseInstance, limit };
}

describe("CanContributeToExperimentGuard", () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
    } as unknown as Reflector;
  });

  function setMetadata(metadata: CanContributeToExperimentMetadata | undefined) {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(metadata);
  }

  function createContext(options?: {
    userId?: string;
    params?: Record<string, unknown>;
    body?: Record<string, unknown>;
  }): ExecutionContext {
    const request = {
      session: options?.userId ? { user: { id: options.userId } } : null,
      params: options?.params ?? {},
      body: options?.body ?? {},
    };

    return {
      getHandler: () => vi.fn(),
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it("allows routes without CanContribute metadata", async () => {
    setMetadata(undefined);
    const { db, limit } = mockDb([]);
    const guard = new CanContributeToExperimentGuard(reflector, db);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(limit).not.toHaveBeenCalled();
  });

  it("fails closed when the authenticated user is missing", async () => {
    setMetadata({});
    const { db } = mockDb([]);
    const guard = new CanContributeToExperimentGuard(reflector, db);

    await expect(
      guard.canActivate(createContext({ params: { id: crypto.randomUUID() } })),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects an invalid experiment id before querying", async () => {
    setMetadata({});
    const { db, limit } = mockDb([]);
    const guard = new CanContributeToExperimentGuard(reflector, db);

    await expect(
      guard.canActivate(createContext({ userId: crypto.randomUUID(), params: { id: "nope" } })),
    ).rejects.toThrow(BadRequestException);
    expect(limit).not.toHaveBeenCalled();
  });

  it("returns not-found when the experiment does not exist", async () => {
    setMetadata({});
    const { db } = mockDb([]);
    const guard = new CanContributeToExperimentGuard(reflector, db);

    await expect(
      guard.canActivate(
        createContext({ userId: crypto.randomUUID(), params: { id: crypto.randomUUID() } }),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("denies a caller who is not a member of the experiment", async () => {
    setMetadata({});
    const experimentId = crypto.randomUUID();
    const { db } = mockDb([{ experimentId, memberId: null }]);
    const guard = new CanContributeToExperimentGuard(reflector, db);

    await expect(
      guard.canActivate(
        createContext({ userId: crypto.randomUUID(), params: { id: experimentId } }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("allows a member of the experiment", async () => {
    setMetadata({});
    const experimentId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const { db } = mockDb([{ experimentId, memberId: userId }]);
    const guard = new CanContributeToExperimentGuard(reflector, db);

    await expect(
      guard.canActivate(createContext({ userId, params: { id: experimentId } })),
    ).resolves.toBe(true);
  });

  it("reads the experiment id from the request body when configured", async () => {
    setMetadata({ source: "body", param: "experimentId" });
    const experimentId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const { db } = mockDb([{ experimentId, memberId: userId }]);
    const guard = new CanContributeToExperimentGuard(reflector, db);

    await expect(
      guard.canActivate(createContext({ userId, body: { experimentId } })),
    ).resolves.toBe(true);
  });
});

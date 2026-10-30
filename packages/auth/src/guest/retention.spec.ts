import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@repo/database";
import type * as Database from "@repo/database";

import { deleteStaleAnonymousRateLimits } from "./retention";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  candidates: vi.fn(),
  deleted: vi.fn(),
  limit: vi.fn(),
  remove: vi.fn(),
  select: vi.fn(),
}));
vi.mock("@repo/database", async (importOriginal) => ({
  ...(await importOriginal<typeof Database>()),
  db: {
    transaction: (work: (tx: unknown) => unknown) =>
      work({
        execute: mocks.execute,
        select: (...args: unknown[]) => {
          mocks.select(...args);
          return {
            from: () => ({
              where: () => ({
                limit: (limit: number) => {
                  mocks.limit(limit);
                  return { for: mocks.candidates };
                },
              }),
            }),
          };
        },
        delete: (...args: unknown[]) => {
          mocks.remove(...args);
          return { where: () => ({ returning: mocks.deleted }) };
        },
      }),
  },
}));

describe("anonymous counter retention transaction", () => {
  const cutoff = new Date("2026-10-01T00:00:00Z");
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execute.mockResolvedValue([]);
    mocks.candidates.mockResolvedValue([]);
    mocks.deleted.mockResolvedValue([]);
  });

  it("does not delete anything when no unlocked stale candidates remain", async () => {
    expect(await deleteStaleAnonymousRateLimits(db, cutoff, 5)).toBe(0);
    expect(mocks.limit).toHaveBeenCalledWith(5);
    expect(mocks.candidates).toHaveBeenCalledWith("update", { skipLocked: true });
    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("returns the rows actually deleted from the locked candidate batch", async () => {
    mocks.candidates.mockResolvedValue([{ id: "00000000-0000-4000-8000-000000000001" }]);
    mocks.deleted.mockResolvedValue([{ id: "00000000-0000-4000-8000-000000000001" }]);
    expect(await deleteStaleAnonymousRateLimits(db, cutoff, 1)).toBe(1);
    expect(mocks.remove).toHaveBeenCalledOnce();
  });

  it("propagates a database failure so the caller cannot report completed cleanup", async () => {
    const error = new Error("database unavailable");
    mocks.candidates.mockRejectedValue(error);
    await expect(deleteStaleAnonymousRateLimits(db, cutoff, 1)).rejects.toBe(error);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});

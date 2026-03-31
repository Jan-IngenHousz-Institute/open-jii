import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { compressForStorage } from "~/utils/storage-compression";

// --- In-memory SQLite mock via Drizzle ---

let dbRows: Record<string, any>[] = [];

vi.mock("../db/client", () => ({
  db: {
    insert: () => {
      const chain: any = {
        values: (vals: any) => {
          chain._vals = vals;
          return chain;
        },
        onConflictDoNothing: () => chain,
        run: () => {
          if (chain._vals) {
            dbRows.push({ ...chain._vals, createdAt: new Date() });
          }
          return { changes: 1 };
        },
      };
      return chain;
    },
    select: () => ({
      from: () => ({
        where: () => ({
          all: () => dbRows.filter((r) => r.status === "successful"),
        }),
      }),
    }),
    delete: () => ({
      where: (..._args: any[]) => ({
        run: () => {
          const before = dbRows.length;
          // Distinguish prune (createdAt filter) vs clear (status only) vs single delete
          // by checking args - simplified mock
          const hasPruneArg = _args.some((a: any) => typeof a === "object");
          if (hasPruneArg) {
            // Prune: remove successful older than 7 days
            const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
            dbRows = dbRows.filter(
              (r) =>
                r.status !== "successful" ||
                new Date(r.createdAt).getTime() >= cutoff,
            );
          } else {
            dbRows = dbRows.filter((r) => r.status !== "successful");
          }
          return { changes: before - dbRows.length };
        },
      }),
    }),
  },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    getAllKeys: vi.fn(() => Promise.resolve([])),
    multiGet: vi.fn(() => Promise.resolve([])),
    removeItem: vi.fn(),
    multiRemove: vi.fn(),
  },
}));

vi.mock("uuid", () => ({
  v4: () => "test-uuid-5678",
}));

const mockUpload = {
  topic: "test/topic",
  measurementResult: { value: 42 },
  metadata: {
    experimentName: "Test Experiment",
    protocolName: "protocol-1",
    timestamp: "2026-03-02T10:00:00.000Z",
  },
};

describe("successful-uploads-storage (Drizzle + SQLite)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbRows = [];
    vi.resetModules();
  });

  describe("saveSuccessfulUpload", () => {
    it("inserts a row into the measurements table", async () => {
      const mod = await import("../successful-uploads-storage");
      await mod.saveSuccessfulUpload(mockUpload);

      expect(dbRows).toHaveLength(1);
      expect(dbRows[0].id).toBe("test-uuid-5678");
      expect(dbRows[0].status).toBe("successful");
    });
  });

  describe("getSuccessfulUploadsWithKeys", () => {
    it("returns successful uploads from the database", async () => {
      dbRows.push({
        id: "abc",
        status: "successful",
        topic: "test/topic",
        measurementResult: compressForStorage({ value: 42 }),
        experimentName: "Test Experiment",
        protocolName: "protocol-1",
        timestamp: "2026-03-02T10:00:00.000Z",
      });

      const mod = await import("../successful-uploads-storage");
      const result = await mod.getSuccessfulUploadsWithKeys();

      expect(result).toHaveLength(1);
      expect(result[0][0]).toBe("abc");
      expect(result[0][1]).toEqual(mockUpload);
    });

    it("returns empty array when no successful uploads exist", async () => {
      const mod = await import("../successful-uploads-storage");
      const result = await mod.getSuccessfulUploadsWithKeys();
      expect(result).toEqual([]);
    });
  });

  describe("clearSuccessfulUploads", () => {
    it("removes all successful uploads but keeps failed ones", async () => {
      dbRows.push({ id: "a", status: "successful" });
      dbRows.push({ id: "b", status: "successful" });
      dbRows.push({ id: "c", status: "failed" });

      const mod = await import("../successful-uploads-storage");
      await mod.clearSuccessfulUploads();

      expect(dbRows).toHaveLength(1);
      expect(dbRows[0].id).toBe("c");
    });
  });

  describe("pruneExpiredUploads", () => {
    it("removes successful uploads older than 7 days", async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const now = new Date();

      dbRows.push({ id: "old", status: "successful", createdAt: eightDaysAgo });
      dbRows.push({ id: "recent", status: "successful", createdAt: now });

      const mod = await import("../successful-uploads-storage");
      mod.pruneExpiredUploads();

      expect(dbRows.find((r) => r.id === "old")).toBeUndefined();
      expect(dbRows.find((r) => r.id === "recent")).toBeDefined();
    });

    it("does not remove failed uploads", async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      dbRows.push({ id: "old-failed", status: "failed", createdAt: eightDaysAgo });

      const mod = await import("../successful-uploads-storage");
      mod.pruneExpiredUploads();

      expect(dbRows.find((r) => r.id === "old-failed")).toBeDefined();
    });
  });

  describe("legacy migration", () => {
    it("migrates AsyncStorage entries to SQLite on first access", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue([
        "SUCCESSFUL_UPLOAD_legacy-1",
        "OTHER_KEY",
      ]);
      vi.mocked(AsyncStorage.multiGet).mockResolvedValue([
        ["SUCCESSFUL_UPLOAD_legacy-1", compressForStorage(mockUpload)],
      ]);

      const mod = await import("../successful-uploads-storage");
      await mod.getSuccessfulUploadsWithKeys();

      expect(dbRows.find((r) => r.id === "legacy-1")).toBeDefined();
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(["SUCCESSFUL_UPLOAD_legacy-1"]);
    });
  });
});

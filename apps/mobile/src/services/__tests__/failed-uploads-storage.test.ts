import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { compressForStorage } from "~/utils/storage-compression";

import {
  saveFailedUpload,
  getFailedUploadsWithKeys,
  updateFailedUpload,
  removeFailedUpload,
  clearFailedUploads,
} from "../failed-uploads-storage";

// --- In-memory SQLite mock via Drizzle ---

let dbRows: Record<string, any>[] = [];

function mockRun(sql: string, params: any[]) {
  const sqlNorm = sql.replace(/\s+/g, " ").trim().toLowerCase();

  if (sqlNorm.startsWith("insert")) {
    const existing = dbRows.find((r) => r.id === params[0]);
    if (!existing || !sqlNorm.includes("on conflict")) {
      dbRows.push({
        id: params[0],
        status: params[1],
        topic: params[2],
        measurementResult: params[3],
        experimentName: params[4],
        protocolName: params[5],
        timestamp: params[6],
        createdAt: new Date(),
      });
    }
    return { changes: 1 };
  }

  if (sqlNorm.startsWith("update")) {
    const idx = dbRows.findIndex((r) => r.status === "failed");
    if (idx >= 0) Object.assign(dbRows[idx], { topic: params[0] });
    return { changes: idx >= 0 ? 1 : 0 };
  }

  if (sqlNorm.startsWith("delete")) {
    const before = dbRows.length;
    if (params.length >= 2) {
      dbRows = dbRows.filter((r) => !(r.id === params[0] && r.status === params[1]));
    } else if (params.length === 1) {
      dbRows = dbRows.filter((r) => r.status !== params[0]);
    }
    return { changes: before - dbRows.length };
  }

  return { changes: 0 };
}

// Build a chainable query mock
function makeChain(type: string) {
  let collectedParams: any[] = [];

  const chain: any = {
    values: (vals: any) => {
      collectedParams = [vals.id, vals.status, vals.topic, vals.measurementResult, vals.experimentName, vals.protocolName, vals.timestamp];
      return chain;
    },
    set: (vals: any) => {
      collectedParams = [vals.topic];
      return chain;
    },
    where: () => chain,
    onConflictDoNothing: () => chain,
    run: () => {
      if (type === "insert") return mockRun("insert", collectedParams);
      if (type === "update") return mockRun("update", collectedParams);
      if (type === "delete") {
        // For delete, extract status from dbRows filter
        return mockRun("delete", collectedParams);
      }
      return { changes: 0 };
    },
    all: () => dbRows.filter((r) => r.status === "failed"),
    from: () => chain,
  };
  return chain;
}

vi.mock("../db/client", () => ({
  db: {
    insert: () => makeChain("insert"),
    select: () => makeChain("select"),
    update: () => makeChain("update"),
    delete: () => {
      const chain = makeChain("delete");
      chain.where = (..._args: any[]) => {
        // Simple: just use the first status-based filter
        return {
          run: () => {
            const before = dbRows.length;
            // Check if we're filtering by id+status or just status
            if (_args.length > 0) {
              // Simplified: just delete failed
              dbRows = dbRows.filter((r) => r.status !== "failed");
            }
            return { changes: before - dbRows.length };
          },
        };
      };
      return chain;
    },
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
  v4: () => "test-uuid-1234",
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

describe("failed-uploads-storage (Drizzle + SQLite)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbRows = [];
    vi.resetModules();
  });

  describe("saveFailedUpload", () => {
    it("inserts a row into the measurements table", async () => {
      const mod = await import("../failed-uploads-storage");
      await mod.saveFailedUpload(mockUpload);

      expect(dbRows).toHaveLength(1);
      expect(dbRows[0].id).toBe("test-uuid-1234");
      expect(dbRows[0].status).toBe("failed");
      expect(dbRows[0].topic).toBe("test/topic");
    });
  });

  describe("getFailedUploadsWithKeys", () => {
    it("returns failed uploads from the database", async () => {
      dbRows.push({
        id: "abc",
        status: "failed",
        topic: "test/topic",
        measurementResult: compressForStorage({ value: 42 }),
        experimentName: "Test Experiment",
        protocolName: "protocol-1",
        timestamp: "2026-03-02T10:00:00.000Z",
      });

      const mod = await import("../failed-uploads-storage");
      const result = await mod.getFailedUploadsWithKeys();

      expect(result).toHaveLength(1);
      expect(result[0][0]).toBe("abc");
      expect(result[0][1]).toEqual(mockUpload);
    });

    it("returns empty array when no failed uploads exist", async () => {
      const mod = await import("../failed-uploads-storage");
      const result = await mod.getFailedUploadsWithKeys();
      expect(result).toEqual([]);
    });
  });

  describe("clearFailedUploads", () => {
    it("removes all failed uploads but keeps successful ones", async () => {
      dbRows.push({ id: "a", status: "failed" });
      dbRows.push({ id: "b", status: "failed" });
      dbRows.push({ id: "c", status: "successful" });

      const mod = await import("../failed-uploads-storage");
      await mod.clearFailedUploads();

      expect(dbRows).toHaveLength(1);
      expect(dbRows[0].id).toBe("c");
    });
  });

  describe("legacy migration", () => {
    it("migrates AsyncStorage entries to SQLite on first access", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue([
        "FAILED_UPLOAD_legacy-1",
        "OTHER_KEY",
      ]);
      vi.mocked(AsyncStorage.multiGet).mockResolvedValue([
        ["FAILED_UPLOAD_legacy-1", compressForStorage(mockUpload)],
      ]);

      const mod = await import("../failed-uploads-storage");
      await mod.getFailedUploadsWithKeys();

      expect(dbRows.find((r) => r.id === "legacy-1")).toBeDefined();
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(["FAILED_UPLOAD_legacy-1"]);
    });
  });
});

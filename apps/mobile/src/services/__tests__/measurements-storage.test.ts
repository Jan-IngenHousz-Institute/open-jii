import AsyncStorage from "@react-native-async-storage/async-storage";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { compressForStorage } from "~/utils/storage-compression";

import * as schema from "../db/schema";

const migrationSql = readFileSync(
  resolve(__dirname, "../../../drizzle/0000_outgoing_firebird.sql"),
  "utf-8",
);

let sqlite: ReturnType<typeof Database>;
let db: ReturnType<typeof drizzle>;

function createTestDb() {
  sqlite = new Database(":memory:");
  sqlite.exec(migrationSql);
  db = drizzle(sqlite, { schema });
}

vi.mock("../db/client", () => ({
  get db() {
    return db;
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

const mockMeasurement = {
  topic: "test/topic",
  measurementResult: { value: 42 },
  metadata: {
    experimentName: "Test Experiment",
    protocolName: "protocol-1",
    timestamp: "2026-03-02T10:00:00.000Z",
  },
};

function insertRow(
  id: string,
  status: "failed" | "successful",
  overrides: Partial<{ topic: string; timestamp: string; createdAt: number }> = {},
) {
  sqlite
    .prepare(
      `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      status,
      overrides.topic ?? "test/topic",
      compressForStorage({ value: 42 }),
      "Test Experiment",
      "protocol-1",
      overrides.timestamp ?? "2026-03-02T10:00:00.000Z",
      overrides.createdAt ?? Date.now(),
    );
}

describe("measurements-storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTestDb();
    vi.resetModules();
  });

  // ---------------------------------------------------------------------------
  // saveMeasurement
  // ---------------------------------------------------------------------------

  describe("saveMeasurement", () => {
    it("inserts a failed row", async () => {
      const mod = await import("../measurements-storage");
      await mod.saveMeasurement(mockMeasurement, "failed");

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("failed");
      expect(rows[0].id).toBe("test-uuid-1234");
    });

    it("inserts a successful row", async () => {
      const mod = await import("../measurements-storage");
      await mod.saveMeasurement(mockMeasurement, "successful");

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("successful");
    });
  });

  // ---------------------------------------------------------------------------
  // getMeasurements
  // ---------------------------------------------------------------------------

  describe("getMeasurements", () => {
    it("returns only failed rows when status is failed", async () => {
      insertRow("f1", "failed");
      insertRow("s1", "successful");

      const mod = await import("../measurements-storage");
      const result = await mod.getMeasurements("failed");

      expect(result).toHaveLength(1);
      expect(result[0][0]).toBe("f1");
    });

    it("returns only successful rows when status is successful", async () => {
      insertRow("f1", "failed");
      insertRow("s1", "successful");

      const mod = await import("../measurements-storage");
      const result = await mod.getMeasurements("successful");

      expect(result).toHaveLength(1);
      expect(result[0][0]).toBe("s1");
    });

    it("returns empty array when no rows match", async () => {
      const mod = await import("../measurements-storage");
      const result = await mod.getMeasurements("failed");
      expect(result).toEqual([]);
    });

    it("deserializes the measurement correctly", async () => {
      insertRow("f1", "failed");

      const mod = await import("../measurements-storage");
      const [[, measurement]] = await mod.getMeasurements("failed");

      expect(measurement).toEqual(mockMeasurement);
    });
  });

  // ---------------------------------------------------------------------------
  // updateMeasurement (status-agnostic)
  // ---------------------------------------------------------------------------

  describe("updateMeasurement", () => {
    it("updates a failed row", async () => {
      insertRow("u1", "failed");

      const mod = await import("../measurements-storage");
      await mod.updateMeasurement("u1", {
        ...mockMeasurement,
        topic: "updated/topic",
      });

      const row = sqlite.prepare("SELECT * FROM measurements WHERE id = 'u1'").get() as any;
      expect(row.topic).toBe("updated/topic");
      expect(row.status).toBe("failed");
    });

    it("updates a successful row", async () => {
      insertRow("u2", "successful");

      const mod = await import("../measurements-storage");
      await mod.updateMeasurement("u2", {
        ...mockMeasurement,
        topic: "updated/topic",
      });

      const row = sqlite.prepare("SELECT * FROM measurements WHERE id = 'u2'").get() as any;
      expect(row.topic).toBe("updated/topic");
      expect(row.status).toBe("successful");
    });
  });

  // ---------------------------------------------------------------------------
  // markAsSuccessful
  // ---------------------------------------------------------------------------

  describe("markAsSuccessful", () => {
    it("transitions a failed row to successful", async () => {
      insertRow("m1", "failed");

      const mod = await import("../measurements-storage");
      await mod.markAsSuccessful("m1");

      const row = sqlite.prepare("SELECT * FROM measurements WHERE id = 'm1'").get() as any;
      expect(row.status).toBe("successful");
    });

    it("does not create a duplicate row", async () => {
      insertRow("m1", "failed");

      const mod = await import("../measurements-storage");
      await mod.markAsSuccessful("m1");

      const rows = sqlite.prepare("SELECT * FROM measurements").all();
      expect(rows).toHaveLength(1);
    });

    it("does not affect other rows", async () => {
      insertRow("target", "failed");
      insertRow("other", "failed");

      const mod = await import("../measurements-storage");
      await mod.markAsSuccessful("target");

      const rows = sqlite.prepare("SELECT * FROM measurements ORDER BY id").all() as any[];
      expect(rows.find((r) => r.id === "target")?.status).toBe("successful");
      expect(rows.find((r) => r.id === "other")?.status).toBe("failed");
    });

    it("is a no-op on a row that is already successful", async () => {
      insertRow("m1", "successful");

      const mod = await import("../measurements-storage");
      await mod.markAsSuccessful("m1");

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("successful");
    });
  });

  // ---------------------------------------------------------------------------
  // removeMeasurement
  // ---------------------------------------------------------------------------

  describe("removeMeasurement", () => {
    it("removes a failed row by key", async () => {
      insertRow("keep", "failed");
      insertRow("gone", "failed");

      const mod = await import("../measurements-storage");
      await mod.removeMeasurement("gone");

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("keep");
    });

    it("removes a successful row by key", async () => {
      insertRow("keep", "successful");
      insertRow("gone", "successful");

      const mod = await import("../measurements-storage");
      await mod.removeMeasurement("gone");

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("keep");
    });
  });

  // ---------------------------------------------------------------------------
  // clearMeasurements
  // ---------------------------------------------------------------------------

  describe("clearMeasurements", () => {
    it("removes all failed rows but keeps successful ones", async () => {
      insertRow("f1", "failed");
      insertRow("f2", "failed");
      insertRow("s1", "successful");

      const mod = await import("../measurements-storage");
      await mod.clearMeasurements("failed");

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("s1");
    });

    it("removes all successful rows but keeps failed ones", async () => {
      insertRow("f1", "failed");
      insertRow("s1", "successful");
      insertRow("s2", "successful");

      const mod = await import("../measurements-storage");
      await mod.clearMeasurements("successful");

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("f1");
    });
  });

  // ---------------------------------------------------------------------------
  // pruneExpiredMeasurements
  // ---------------------------------------------------------------------------

  describe("pruneExpiredMeasurements", () => {
    it("removes successful rows older than 7 days", async () => {
      const eightDaysAgoMs = Date.now() - 8 * 24 * 60 * 60 * 1000;
      const oneDayAgoMs = Date.now() - 1 * 24 * 60 * 60 * 1000;
      const eightDaysAgo = new Date(eightDaysAgoMs).toISOString();
      const oneDayAgo = new Date(oneDayAgoMs).toISOString();

      insertRow("old", "successful", { timestamp: eightDaysAgo, createdAt: eightDaysAgoMs });
      insertRow("recent", "successful", { timestamp: oneDayAgo, createdAt: oneDayAgoMs });

      const mod = await import("../measurements-storage");
      await mod.pruneExpiredMeasurements();

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("recent");
    });

    it("does not remove failed rows even if old", async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      // createdAt is intentionally recent to conflict with the old timestamp,
      // ensuring the pruning logic uses timestamp (not createdAt) to judge age.
      insertRow("old-failed", "failed", { timestamp: eightDaysAgo, createdAt: Date.now() });

      const mod = await import("../measurements-storage");
      await mod.pruneExpiredMeasurements();

      const rows = sqlite.prepare("SELECT * FROM measurements").all();
      expect(rows).toHaveLength(1);
    });

    it("keeps successful rows within 7 days", async () => {
      const sixDaysAgoMs = Date.now() - 6 * 24 * 60 * 60 * 1000;
      const sixDaysAgo = new Date(sixDaysAgoMs).toISOString();
      const eightDaysAgoMs = Date.now() - 8 * 24 * 60 * 60 * 1000;
      // createdAt is intentionally older than 7 days to conflict with the recent
      // timestamp, ensuring the pruning logic uses timestamp (not createdAt).
      insertRow("within-window", "successful", { timestamp: sixDaysAgo, createdAt: eightDaysAgoMs });

      const mod = await import("../measurements-storage");
      await mod.pruneExpiredMeasurements();

      const rows = sqlite.prepare("SELECT * FROM measurements").all();
      expect(rows).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // legacy migration
  // ---------------------------------------------------------------------------

  describe("legacy migration", () => {
    it("migrates FAILED_UPLOAD_ keys as failed", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue(["FAILED_UPLOAD_legacy-f1"]);
      vi.mocked(AsyncStorage.multiGet).mockResolvedValue([
        ["FAILED_UPLOAD_legacy-f1", compressForStorage(mockMeasurement)],
      ]);

      const mod = await import("../measurements-storage");
      await mod.getMeasurements("failed");

      const rows = sqlite
        .prepare("SELECT * FROM measurements WHERE id = 'legacy-f1'")
        .all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("failed");
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(["FAILED_UPLOAD_legacy-f1"]);
    });

    it("migrates SUCCESSFUL_UPLOAD_ keys as successful", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue(["SUCCESSFUL_UPLOAD_legacy-s1"]);
      vi.mocked(AsyncStorage.multiGet).mockResolvedValue([
        ["SUCCESSFUL_UPLOAD_legacy-s1", compressForStorage(mockMeasurement)],
      ]);

      const mod = await import("../measurements-storage");
      await mod.getMeasurements("successful");

      const rows = sqlite
        .prepare("SELECT * FROM measurements WHERE id = 'legacy-s1'")
        .all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("successful");
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(["SUCCESSFUL_UPLOAD_legacy-s1"]);
    });

    it("migrates both prefixes in a single migration run with correct statuses", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue([
        "FAILED_UPLOAD_legacy-f1",
        "SUCCESSFUL_UPLOAD_legacy-s1",
        "UNRELATED_KEY",
      ]);
      vi.mocked(AsyncStorage.multiGet)
        .mockResolvedValueOnce([["FAILED_UPLOAD_legacy-f1", compressForStorage(mockMeasurement)]])
        .mockResolvedValueOnce([
          ["SUCCESSFUL_UPLOAD_legacy-s1", compressForStorage(mockMeasurement)],
        ]);

      const mod = await import("../measurements-storage");
      await mod.getMeasurements("failed"); // triggers migration

      const rows = sqlite.prepare("SELECT id, status FROM measurements ORDER BY id").all() as any[];
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.id === "legacy-f1")?.status).toBe("failed");
      expect(rows.find((r) => r.id === "legacy-s1")?.status).toBe("successful");
    });

    it("ignores keys that do not match any known prefix", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue(["UNRELATED_KEY", "OTHER_KEY"]);

      const mod = await import("../measurements-storage");
      await mod.getMeasurements("failed");

      const rows = sqlite.prepare("SELECT * FROM measurements").all();
      expect(rows).toHaveLength(0);
      expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
    });

    it("migrates a legacy entry with an invalid timestamp and auto-fills created_at", async () => {
      const invalidTimestampMeasurement = {
        ...mockMeasurement,
        metadata: { ...mockMeasurement.metadata, timestamp: "not-a-date" },
      };

      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue(["FAILED_UPLOAD_legacy-bad-ts"]);
      vi.mocked(AsyncStorage.multiGet).mockResolvedValue([
        ["FAILED_UPLOAD_legacy-bad-ts", compressForStorage(invalidTimestampMeasurement)],
      ]);

      const mod = await import("../measurements-storage");
      await mod.getMeasurements("failed");

      const rows = sqlite
        .prepare("SELECT * FROM measurements WHERE id = 'legacy-bad-ts'")
        .all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("failed");
      // created_at must not be null: the invalid timestamp is excluded from the
      // insert and Drizzle's $defaultFn fills in the current time instead.
      expect(rows[0].created_at).not.toBeNull();
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(["FAILED_UPLOAD_legacy-bad-ts"]);
    });

    it("runs migration exactly once regardless of how many functions are called", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue(["FAILED_UPLOAD_once"]);
      vi.mocked(AsyncStorage.multiGet).mockResolvedValue([
        ["FAILED_UPLOAD_once", compressForStorage(mockMeasurement)],
      ]);

      const mod = await import("../measurements-storage");
      await mod.getMeasurements("failed");
      await mod.getMeasurements("successful");
      await mod.saveMeasurement(mockMeasurement, "failed");

      expect(AsyncStorage.getAllKeys).toHaveBeenCalledTimes(1);
    });
  });
});

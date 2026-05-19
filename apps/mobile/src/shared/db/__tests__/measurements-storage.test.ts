import AsyncStorage from "@react-native-async-storage/async-storage";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { compressForStorage } from "~/shared/utils/storage-compression";

import * as schema from "../schema";

const migrationFiles = ["0000_outgoing_firebird.sql", "0001_add_pending_status.sql"];
const migrationSqls = migrationFiles.map((f) =>
  readFileSync(resolve(__dirname, "../../../../drizzle", f), "utf-8"),
);

let sqlite: ReturnType<typeof Database>;
let db: ReturnType<typeof drizzle>;

function createTestDb() {
  sqlite = new Database(":memory:");
  for (const sql of migrationSqls) {
    // Drizzle uses "--> statement-breakpoint" markers as a hint to its mobile
    // migrator; better-sqlite3.exec already understands ; separators, so
    // stripping the marker is enough.
    sqlite.exec(sql.replace(/-->\s*statement-breakpoint/g, ""));
  }
  db = drizzle(sqlite, { schema });
}

vi.mock("../client", () => ({
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
  status: "pending" | "failed" | "uploading" | "successful",
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
    it("inserts a pending row and returns its id (save-first default)", async () => {
      const mod = await import("../measurements-storage");
      const id = await mod.saveMeasurement(mockMeasurement, "pending");

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("pending");
      expect(rows[0].id).toBe("test-uuid-1234");
      expect(id).toBe("test-uuid-1234");
    });

    it("inserts a failed row and returns its id", async () => {
      const mod = await import("../measurements-storage");
      const id = await mod.saveMeasurement(mockMeasurement, "failed");

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("failed");
      expect(id).toBe("test-uuid-1234");
    });

    it("inserts a successful row", async () => {
      const mod = await import("../measurements-storage");
      await mod.saveMeasurement(mockMeasurement, "successful");

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("successful");
    });

    it("rejects an unknown status at the database level (CHECK constraint)", () => {
      // The DB-level CHECK constraint must reject anything outside the enum,
      // even if a type-cast slips past the TS guard.
      expect(() =>
        sqlite
          .prepare(
            `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
             VALUES ('bad', 'gibberish', 't', '{}', 'e', 'p', '2026-01-01', 0)`,
          )
          .run(),
      ).toThrow(/CHECK constraint/i);
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
      expect(result[0].id).toBe("f1");
      expect(result[0].status).toBe("failed");
    });

    it("returns only successful rows when status is successful", async () => {
      insertRow("f1", "failed");
      insertRow("s1", "successful");

      const mod = await import("../measurements-storage");
      const result = await mod.getMeasurements("successful");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("s1");
      expect(result[0].status).toBe("successful");
    });

    it("returns empty array when no rows match", async () => {
      const mod = await import("../measurements-storage");
      const result = await mod.getMeasurements("failed");
      expect(result).toEqual([]);
    });

    it("deserializes the measurement correctly", async () => {
      insertRow("f1", "failed");

      const mod = await import("../measurements-storage");
      const [first] = await mod.getMeasurements("failed");

      expect(first.data).toEqual(mockMeasurement);
    });

    it("returns rows for multiple statuses in one query (array form)", async () => {
      insertRow("p1", "pending");
      insertRow("f1", "failed");
      insertRow("s1", "successful");

      const mod = await import("../measurements-storage");
      const result = await mod.getMeasurements(["pending", "failed"]);

      expect(result).toHaveLength(2);
      const byId = new Map(result.map((r) => [r.id, r.status]));
      expect(byId.get("p1")).toBe("pending");
      expect(byId.get("f1")).toBe("failed");
      expect(byId.has("s1")).toBe(false);
    });

    it("returns empty array when called with an empty status list", async () => {
      insertRow("p1", "pending");

      const mod = await import("../measurements-storage");
      const result = await mod.getMeasurements([]);

      expect(result).toEqual([]);
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
  // countMeasurementsByStatus
  // ---------------------------------------------------------------------------

  describe("countMeasurementsByStatus", () => {
    it("returns the per-status counts via a single GROUP BY query", async () => {
      insertRow("p1", "pending");
      insertRow("p2", "pending");
      insertRow("f1", "failed");
      insertRow("u1", "uploading");
      insertRow("s1", "successful");
      insertRow("s2", "successful");
      insertRow("s3", "successful");

      const mod = await import("../measurements-storage");
      const counts = await mod.countMeasurementsByStatus();

      expect(counts).toEqual({ pending: 2, failed: 1, uploading: 1, successful: 3 });
    });

    it("returns zeros when the table is empty", async () => {
      const mod = await import("../measurements-storage");
      const counts = await mod.countMeasurementsByStatus();
      expect(counts).toEqual({ pending: 0, failed: 0, uploading: 0, successful: 0 });
    });

    it("returns zeros and logs when the underlying query throws", async () => {
      const mod = await import("../measurements-storage");
      // Force the count query to throw by destroying the table mid-test.
      sqlite.prepare("DROP TABLE measurements").run();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

      const counts = await mod.countMeasurementsByStatus();

      expect(counts).toEqual({ pending: 0, failed: 0, uploading: 0, successful: 0 });
      expect(consoleSpy).toHaveBeenCalledWith("Failed to count measurements:", expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // markAsSuccessful
  // ---------------------------------------------------------------------------

  describe("markAsSuccessful", () => {
    it("transitions an uploading row to successful", async () => {
      insertRow("m1", "uploading");

      const mod = await import("../measurements-storage");
      await mod.markAsSuccessful("m1");

      const row = sqlite.prepare("SELECT * FROM measurements WHERE id = 'm1'").get() as any;
      expect(row.status).toBe("successful");
    });

    it("does not create a duplicate row", async () => {
      insertRow("m1", "uploading");

      const mod = await import("../measurements-storage");
      await mod.markAsSuccessful("m1");

      const rows = sqlite.prepare("SELECT * FROM measurements").all();
      expect(rows).toHaveLength(1);
    });

    it("does not affect other rows", async () => {
      insertRow("target", "uploading");
      insertRow("other", "uploading");

      const mod = await import("../measurements-storage");
      await mod.markAsSuccessful("target");

      const rows = sqlite.prepare("SELECT * FROM measurements ORDER BY id").all() as any[];
      expect(rows.find((r) => r.id === "target")?.status).toBe("successful");
      expect(rows.find((r) => r.id === "other")?.status).toBe("uploading");
    });

    it("is a no-op on a row that is already successful", async () => {
      insertRow("m1", "successful");

      const mod = await import("../measurements-storage");
      await mod.markAsSuccessful("m1");

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("successful");
    });

    it("transitions a failed row directly to successful (manual retry)", async () => {
      insertRow("m1", "failed");

      const mod = await import("../measurements-storage");
      await mod.markAsSuccessful("m1");

      const row = sqlite.prepare("SELECT * FROM measurements WHERE id = 'm1'").get() as any;
      expect(row.status).toBe("successful");
    });

    it("transitions a pending row directly to successful (save-first flow)", async () => {
      insertRow("m1", "pending");

      const mod = await import("../measurements-storage");
      await mod.markAsSuccessful("m1");

      const row = sqlite.prepare("SELECT * FROM measurements WHERE id = 'm1'").get() as any;
      expect(row.status).toBe("successful");
    });
  });

  // ---------------------------------------------------------------------------
  // markAsUploading
  // ---------------------------------------------------------------------------

  describe("markAsUploading", () => {
    it("returns an empty array for an empty key list", async () => {
      const mod = await import("../measurements-storage");
      const ids = await mod.markAsUploading([]);
      expect(ids).toEqual([]);
    });

    it("returns the ids of rows transitioned from failed to uploading", async () => {
      insertRow("m1", "failed");
      insertRow("m2", "failed");

      const mod = await import("../measurements-storage");
      const ids = await mod.markAsUploading(["m1", "m2"]);

      expect([...ids].sort()).toEqual(["m1", "m2"]);
      const rows = sqlite.prepare("SELECT id, status FROM measurements ORDER BY id").all() as any[];
      expect(rows.map((r) => r.status)).toEqual(["uploading", "uploading"]);
    });

    it("returns an empty array when the row is already uploading", async () => {
      insertRow("m1", "uploading");

      const mod = await import("../measurements-storage");
      const ids = await mod.markAsUploading(["m1"]);

      expect(ids).toEqual([]);
    });

    it("returns an empty array when the row does not exist", async () => {
      const mod = await import("../measurements-storage");
      const ids = await mod.markAsUploading(["does-not-exist"]);
      expect(ids).toEqual([]);
    });

    it("returns only pending or failed rows when given a mixed batch", async () => {
      insertRow("m0", "pending");
      insertRow("m1", "failed");
      insertRow("m2", "uploading");
      insertRow("m3", "successful");

      const mod = await import("../measurements-storage");
      const ids = await mod.markAsUploading(["m0", "m1", "m2", "m3"]);

      expect([...ids].sort()).toEqual(["m0", "m1"]);
    });

    it("transitions pending rows to uploading", async () => {
      insertRow("p1", "pending");
      insertRow("p2", "pending");

      const mod = await import("../measurements-storage");
      const ids = await mod.markAsUploading(["p1", "p2"]);

      expect([...ids].sort()).toEqual(["p1", "p2"]);
      const rows = sqlite.prepare("SELECT id, status FROM measurements ORDER BY id").all() as any[];
      expect(rows.map((r) => r.status)).toEqual(["uploading", "uploading"]);
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
      insertRow("old-failed", "failed", {
        timestamp: eightDaysAgo,
        createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      });

      const mod = await import("../measurements-storage");
      await mod.pruneExpiredMeasurements();

      const rows = sqlite.prepare("SELECT * FROM measurements").all();
      expect(rows).toHaveLength(1);
    });

    it("keeps successful rows within 7 days", async () => {
      const sixDaysAgoMs = Date.now() - 6 * 24 * 60 * 60 * 1000;
      const sixDaysAgo = new Date(sixDaysAgoMs).toISOString();
      insertRow("within-window", "successful", {
        timestamp: sixDaysAgo,
        createdAt: sixDaysAgoMs,
      });

      const mod = await import("../measurements-storage");
      await mod.pruneExpiredMeasurements();

      const rows = sqlite.prepare("SELECT * FROM measurements").all();
      expect(rows).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // markAsFailed
  // ---------------------------------------------------------------------------

  describe("markAsFailed", () => {
    it("reverts an uploading row to failed", async () => {
      insertRow("m1", "uploading");

      const mod = await import("../measurements-storage");
      await mod.markAsFailed("m1");

      const row = sqlite.prepare("SELECT * FROM measurements WHERE id = 'm1'").get() as any;
      expect(row.status).toBe("failed");
    });

    it("transitions a pending row to failed (save-first MQTT errored)", async () => {
      insertRow("m1", "pending");

      const mod = await import("../measurements-storage");
      await mod.markAsFailed("m1");

      const row = sqlite.prepare("SELECT * FROM measurements WHERE id = 'm1'").get() as any;
      expect(row.status).toBe("failed");
    });

    it("is a no-op on a row that is already failed", async () => {
      insertRow("m1", "failed");

      const mod = await import("../measurements-storage");
      await mod.markAsFailed("m1");

      const row = sqlite.prepare("SELECT * FROM measurements WHERE id = 'm1'").get() as any;
      expect(row.status).toBe("failed");
    });

    it("is a no-op on a successful row", async () => {
      insertRow("m1", "successful");

      const mod = await import("../measurements-storage");
      await mod.markAsFailed("m1");

      const row = sqlite.prepare("SELECT * FROM measurements WHERE id = 'm1'").get() as any;
      expect(row.status).toBe("successful");
    });

    it("does not affect other rows", async () => {
      insertRow("target", "uploading");
      insertRow("other", "uploading");

      const mod = await import("../measurements-storage");
      await mod.markAsFailed("target");

      const rows = sqlite.prepare("SELECT id, status FROM measurements ORDER BY id").all() as any[];
      expect(rows.find((r) => r.id === "target")?.status).toBe("failed");
      expect(rows.find((r) => r.id === "other")?.status).toBe("uploading");
    });
  });

  // ---------------------------------------------------------------------------
  // resetUploadingMeasurements
  // ---------------------------------------------------------------------------

  describe("resetUploadingMeasurements", () => {
    it("reverts all uploading rows to pending (interrupted, not actually failed)", async () => {
      insertRow("u1", "uploading");
      insertRow("u2", "uploading");
      insertRow("f1", "failed");
      insertRow("s1", "successful");

      const mod = await import("../measurements-storage");
      await mod.resetUploadingMeasurements();

      const rows = sqlite.prepare("SELECT id, status FROM measurements ORDER BY id").all() as any[];
      expect(rows.find((r) => r.id === "u1")?.status).toBe("pending");
      expect(rows.find((r) => r.id === "u2")?.status).toBe("pending");
      expect(rows.find((r) => r.id === "f1")?.status).toBe("failed");
      expect(rows.find((r) => r.id === "s1")?.status).toBe("successful");
    });

    it("is a no-op when no rows are uploading", async () => {
      insertRow("f1", "failed");
      insertRow("s1", "successful");

      const mod = await import("../measurements-storage");
      await mod.resetUploadingMeasurements();

      const rows = sqlite.prepare("SELECT id, status FROM measurements ORDER BY id").all() as any[];
      expect(rows.find((r) => r.id === "f1")?.status).toBe("failed");
      expect(rows.find((r) => r.id === "s1")?.status).toBe("successful");
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

// =============================================================================
// Migration upgrade path: seed a v0 DB, run 0001, verify data + CHECK constraint
// =============================================================================

describe("0001_add_pending_status migration — upgrade path", () => {
  const m0000Sql = readFileSync(
    resolve(__dirname, "../../../../drizzle/0000_outgoing_firebird.sql"),
    "utf-8",
  );
  const m0001Sql = readFileSync(
    resolve(__dirname, "../../../../drizzle/0001_add_pending_status.sql"),
    "utf-8",
  );

  function applyMigration(target: ReturnType<typeof Database>, sql: string) {
    target.exec(sql.replace(/-->\s*statement-breakpoint/g, ""));
  }

  function seedV0Rows(target: ReturnType<typeof Database>) {
    const stmt = target.prepare(
      `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    stmt.run("a", "failed", "topic/a", "{}", "Exp", "P", "2026-03-01T10:00:00Z", 1000);
    stmt.run("b", "uploading", "topic/b", "{}", "Exp", "P", "2026-03-01T11:00:00Z", 2000);
    stmt.run("c", "successful", "topic/c", "{}", "Exp", "P", "2026-03-01T12:00:00Z", 3000);
  }

  it("preserves every existing row with its original status", () => {
    const target = new Database(":memory:");
    applyMigration(target, m0000Sql);
    seedV0Rows(target);

    applyMigration(target, m0001Sql);

    const rows = target.prepare("SELECT id, status FROM measurements ORDER BY id").all() as {
      id: string;
      status: string;
    }[];
    expect(rows).toEqual([
      { id: "a", status: "failed" },
      { id: "b", status: "uploading" },
      { id: "c", status: "successful" },
    ]);
  });

  it("preserves every non-status column (topic, measurement_result, timestamps, etc.)", () => {
    const target = new Database(":memory:");
    applyMigration(target, m0000Sql);
    seedV0Rows(target);

    applyMigration(target, m0001Sql);

    const a = target.prepare("SELECT * FROM measurements WHERE id = 'a'").get() as any;
    expect(a).toMatchObject({
      id: "a",
      status: "failed",
      topic: "topic/a",
      measurement_result: "{}",
      experiment_name: "Exp",
      protocol_name: "P",
      timestamp: "2026-03-01T10:00:00Z",
      created_at: 1000,
    });
  });

  it("activates the CHECK constraint after migration (rejects unknown statuses)", () => {
    const target = new Database(":memory:");
    applyMigration(target, m0000Sql);
    seedV0Rows(target);

    // Pre-migration: SQLite has no CHECK so anything goes.
    expect(() =>
      target
        .prepare(
          `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
           VALUES ('pre', 'gibberish', 't', '{}', 'e', 'p', '2026-01-01', 0)`,
        )
        .run(),
    ).not.toThrow();
    target.prepare("DELETE FROM measurements WHERE id = 'pre'").run();

    applyMigration(target, m0001Sql);

    // Post-migration: same gibberish is rejected.
    expect(() =>
      target
        .prepare(
          `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
           VALUES ('post', 'gibberish', 't', '{}', 'e', 'p', '2026-01-01', 0)`,
        )
        .run(),
    ).toThrow(/CHECK constraint/i);
  });

  it("accepts the new 'pending' status after migration", () => {
    const target = new Database(":memory:");
    applyMigration(target, m0000Sql);
    seedV0Rows(target);
    applyMigration(target, m0001Sql);

    expect(() =>
      target
        .prepare(
          `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
           VALUES ('p1', 'pending', 't', '{}', 'e', 'p', '2026-01-01', 0)`,
        )
        .run(),
    ).not.toThrow();
    const row = target.prepare("SELECT status FROM measurements WHERE id = 'p1'").get() as any;
    expect(row.status).toBe("pending");
  });

  it("is safely re-runnable: data + constraint survive a second apply", () => {
    // Drizzle's mobile migrator tracks applied migrations and won't normally
    // re-run a tagged migration, but we still want the SQL itself to be
    // re-runnable without corrupting data — the recreate-then-rename pattern
    // is naturally idempotent because each apply rebuilds the table fresh
    // from the current rows.
    const target = new Database(":memory:");
    applyMigration(target, m0000Sql);
    seedV0Rows(target);
    applyMigration(target, m0001Sql);
    applyMigration(target, m0001Sql); // second run

    const rows = target.prepare("SELECT id, status FROM measurements ORDER BY id").all() as {
      id: string;
      status: string;
    }[];
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    // Constraint still enforced after the second apply.
    expect(() =>
      target
        .prepare(
          `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
           VALUES ('post', 'gibberish', 't', '{}', 'e', 'p', '2026-01-01', 0)`,
        )
        .run(),
    ).toThrow(/CHECK constraint/i);
  });
});

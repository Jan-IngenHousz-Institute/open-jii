import AsyncStorage from "@react-native-async-storage/async-storage";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { compressForStorage } from "~/utils/storage-compression";

import * as schema from "../db/schema";

// --- Real in-memory SQLite via better-sqlite3 + Drizzle ---

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
    createTestDb();
    vi.resetModules();
  });

  describe("saveSuccessfulUpload", () => {
    it("inserts a row into the measurements table", async () => {
      const mod = await import("../successful-uploads-storage");
      await mod.saveSuccessfulUpload(mockUpload);

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("test-uuid-5678");
      expect(rows[0].status).toBe("successful");
    });
  });

  describe("getSuccessfulUploadsWithKeys", () => {
    it("returns successful uploads from the database", async () => {
      sqlite
        .prepare(
          `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "abc",
          "successful",
          "test/topic",
          compressForStorage({ value: 42 }),
          "Test Experiment",
          "protocol-1",
          "2026-03-02T10:00:00.000Z",
          Date.now(),
        );

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

    it("does not return failed uploads", async () => {
      sqlite
        .prepare(
          `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "xyz",
          "failed",
          "test/topic",
          compressForStorage({ value: 42 }),
          "Test Experiment",
          "protocol-1",
          "2026-03-02T10:00:00.000Z",
          Date.now(),
        );

      const mod = await import("../successful-uploads-storage");
      const result = await mod.getSuccessfulUploadsWithKeys();
      expect(result).toEqual([]);
    });
  });

  describe("clearSuccessfulUploads", () => {
    it("removes all successful uploads but keeps failed ones", async () => {
      const insert = sqlite.prepare(
        `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      insert.run("a", "successful", "t", "d", "e", "p", "ts", Date.now());
      insert.run("b", "successful", "t", "d", "e", "p", "ts", Date.now());
      insert.run("c", "failed", "t", "d", "e", "p", "ts", Date.now());

      const mod = await import("../successful-uploads-storage");
      mod.clearSuccessfulUploads();

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("c");
    });
  });

  describe("removeSuccessfulUpload", () => {
    it("removes a single successful upload by key", async () => {
      const insert = sqlite.prepare(
        `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      insert.run("keep", "successful", "t", "d", "e", "p", "ts", Date.now());
      insert.run("remove", "successful", "t", "d", "e", "p", "ts", Date.now());

      const mod = await import("../successful-uploads-storage");
      mod.removeSuccessfulUpload("remove");

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("keep");
    });
  });

  describe("pruneExpiredUploads", () => {
    it("removes successful uploads with a timestamp older than 7 days", async () => {
      const eightDaysAgoIso = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const oneDayAgoIso = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

      const insert = sqlite.prepare(
        `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      insert.run("old", "successful", "t", "d", "e", "p", eightDaysAgoIso, Date.now());
      insert.run("recent", "successful", "t", "d", "e", "p", oneDayAgoIso, Date.now());

      const mod = await import("../successful-uploads-storage");
      mod.pruneExpiredUploads();

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("recent");
    });

    it("does not remove failed uploads even if their timestamp is old", async () => {
      const eightDaysAgoIso = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

      sqlite
        .prepare(
          `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("old-failed", "failed", "t", "d", "e", "p", eightDaysAgoIso, Date.now());

      const mod = await import("../successful-uploads-storage");
      mod.pruneExpiredUploads();

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("old-failed");
    });

    it("keeps successful uploads whose timestamp is within 7 days", async () => {
      const sixDaysAgoIso = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

      sqlite
        .prepare(
          `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("within-window", "successful", "t", "d", "e", "p", sixDaysAgoIso, Date.now());

      const mod = await import("../successful-uploads-storage");
      mod.pruneExpiredUploads();

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("within-window");
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

      const rows = sqlite
        .prepare("SELECT * FROM measurements WHERE id = 'legacy-1'")
        .all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("successful");
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(["SUCCESSFUL_UPLOAD_legacy-1"]);
    });
  });
});

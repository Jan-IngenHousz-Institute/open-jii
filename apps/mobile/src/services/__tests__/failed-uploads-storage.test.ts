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
    createTestDb();
    vi.resetModules();
  });

  describe("saveFailedUpload", () => {
    it("inserts a row into the measurements table", async () => {
      const mod = await import("../failed-uploads-storage");
      await mod.saveFailedUpload(mockUpload);

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("test-uuid-1234");
      expect(rows[0].status).toBe("failed");
      expect(rows[0].topic).toBe("test/topic");
    });
  });

  describe("getFailedUploadsWithKeys", () => {
    it("returns failed uploads from the database", async () => {
      sqlite
        .prepare(
          `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "abc",
          "failed",
          "test/topic",
          compressForStorage({ value: 42 }),
          "Test Experiment",
          "protocol-1",
          "2026-03-02T10:00:00.000Z",
          Date.now(),
        );

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

    it("does not return successful uploads", async () => {
      sqlite
        .prepare(
          `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "xyz",
          "successful",
          "test/topic",
          compressForStorage({ value: 42 }),
          "Test Experiment",
          "protocol-1",
          "2026-03-02T10:00:00.000Z",
          Date.now(),
        );

      const mod = await import("../failed-uploads-storage");
      const result = await mod.getFailedUploadsWithKeys();
      expect(result).toEqual([]);
    });
  });

  describe("clearFailedUploads", () => {
    it("removes all failed uploads but keeps successful ones", async () => {
      const insert = sqlite.prepare(
        `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      insert.run("a", "failed", "t", "d", "e", "p", "ts", Date.now());
      insert.run("b", "failed", "t", "d", "e", "p", "ts", Date.now());
      insert.run("c", "successful", "t", "d", "e", "p", "ts", Date.now());

      const mod = await import("../failed-uploads-storage");
      mod.clearFailedUploads();

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("c");
    });
  });

  describe("removeFailedUpload", () => {
    it("removes a single failed upload by key", async () => {
      const insert = sqlite.prepare(
        `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      insert.run("keep", "failed", "t", "d", "e", "p", "ts", Date.now());
      insert.run("remove", "failed", "t", "d", "e", "p", "ts", Date.now());

      const mod = await import("../failed-uploads-storage");
      mod.removeFailedUpload("remove");

      const rows = sqlite.prepare("SELECT * FROM measurements").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("keep");
    });
  });

  describe("legacy migration", () => {
    it("migrates AsyncStorage entries to SQLite on first access", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue(["FAILED_UPLOAD_legacy-1", "OTHER_KEY"]);
      vi.mocked(AsyncStorage.multiGet).mockResolvedValue([
        ["FAILED_UPLOAD_legacy-1", compressForStorage(mockUpload)],
      ]);

      const mod = await import("../failed-uploads-storage");
      await mod.getFailedUploadsWithKeys();

      const rows = sqlite
        .prepare("SELECT * FROM measurements WHERE id = 'legacy-1'")
        .all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("failed");
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(["FAILED_UPLOAD_legacy-1"]);
    });
  });
});

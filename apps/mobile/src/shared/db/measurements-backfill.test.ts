import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { compressForStorage } from "~/shared/compression/storage-compression";
import * as schema from "~/shared/db/schema";

const migrationSqls = [
  "0000_outgoing_firebird.sql",
  "0001_add_pending_status.sql",
  "0002_dashing_lenny_balinger.sql",
  "0003_drop_uploading_status.sql",
  "0004_add_day_key.sql",
  "0005_add_workbook_run_id.sql",
].map((f) => readFileSync(resolve(__dirname, "../../../drizzle", f), "utf-8"));

let sqlite: ReturnType<typeof Database>;
let db: ReturnType<typeof drizzle>;

function createTestDb() {
  sqlite = new Database(":memory:");
  for (const sql of migrationSqls) {
    sqlite.exec(sql.replace(/-->\s*statement-breakpoint/g, ""));
  }
  db = drizzle(sqlite, { schema });
}

vi.mock("~/shared/db/client", () => ({
  get db() {
    return db;
  },
}));

// A row as it looks before migrations 0004/0005 backfill: derived columns NULL.
function insertLegacyRow(id: string, payload: object) {
  sqlite
    .prepare(
      `INSERT INTO measurements
       (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at, questions_text, has_comment, day_key, workbook_run_id)
       VALUES (?, 'successful', 't/t', ?, 'Exp', 'proto', '2026-03-02T10:00:00.000Z', 0, NULL, 0, NULL, NULL)`,
    )
    .run(id, compressForStorage(payload));
}

function runIdOf(id: string): string | null {
  return (
    sqlite.prepare("SELECT workbook_run_id FROM measurements WHERE id = ?").get(id) as {
      workbook_run_id: string | null;
    }
  ).workbook_run_id;
}

describe("backfillDerivedColumns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTestDb();
    vi.resetModules();
  });

  it("fills workbook_run_id from the stored payload", async () => {
    insertLegacyRow("grouped", { workbook_run_id: "run-abc", questions: [] });

    const mod = await import("~/shared/db/measurements-backfill");
    await mod.backfillDerivedColumns();

    expect(runIdOf("grouped")).toBe("run-abc");
  });

  it('writes "" for payloads that predate workbook run ids', async () => {
    insertLegacyRow("old", { questions: [] });

    const mod = await import("~/shared/db/measurements-backfill");
    await mod.backfillDerivedColumns();

    expect(runIdOf("old")).toBe("");
  });

  it("fills day_key and questions_text in the same pass", async () => {
    const questions = [{ question_label: "lbl", question_text: "ask?", question_answer: "yes" }];
    insertLegacyRow("legacy", { questions, workbook_run_id: "run-1" });

    const mod = await import("~/shared/db/measurements-backfill");
    await mod.backfillDerivedColumns();

    const row = sqlite
      .prepare("SELECT questions_text, day_key FROM measurements WHERE id = 'legacy'")
      .get() as { questions_text: string; day_key: string };
    expect(JSON.parse(row.questions_text)).toEqual(questions);
    expect(row.day_key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("still marks a row whose payload cannot be decompressed, so it isn't rescanned", async () => {
    sqlite
      .prepare(
        `INSERT INTO measurements
         (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at, questions_text, has_comment, day_key, workbook_run_id)
         VALUES ('corrupt', 'successful', 't/t', 'not-compressed', 'Exp', 'proto', '2026-03-02T10:00:00.000Z', 0, NULL, 0, NULL, NULL)`,
      )
      .run();

    const mod = await import("~/shared/db/measurements-backfill");
    await mod.backfillDerivedColumns();

    expect(runIdOf("corrupt")).toBe("");
    const row = sqlite
      .prepare("SELECT questions_text FROM measurements WHERE id = 'corrupt'")
      .get();
    expect(row).toEqual({ questions_text: "[]" });
  });

  it("terminates and leaves nothing to do on a second pass", async () => {
    insertLegacyRow("a", { workbook_run_id: "run-1", questions: [] });
    insertLegacyRow("b", { questions: [] });

    const mod = await import("~/shared/db/measurements-backfill");
    await mod.backfillDerivedColumns();
    await mod.backfillDerivedColumns();

    const pending = sqlite
      .prepare(
        "SELECT COUNT(*) AS n FROM measurements WHERE questions_text IS NULL OR day_key IS NULL OR workbook_run_id IS NULL",
      )
      .get();
    expect(pending).toEqual({ n: 0 });
  });
});

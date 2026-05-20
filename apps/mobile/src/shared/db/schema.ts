import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Measurement lifecycle:
 *   pending     — saved locally, never attempted upload yet (default for
 *                 newly-recorded measurements in the save-first flow).
 *   uploading   — MQTT publish in progress.
 *   failed      — upload was attempted and failed.
 *   successful  — uploaded to AWS IoT.
 *
 * "pending" is distinct from "failed" so field metrics don't conflate
 * never-attempted rows with rows that genuinely failed.
 */
export const MEASUREMENT_STATUSES = ["pending", "uploading", "failed", "successful"] as const;

export const measurements = sqliteTable(
  "measurements",
  {
    id: text("id").primaryKey(),
    status: text("status", { enum: MEASUREMENT_STATUSES }).notNull(),
    topic: text("topic").notNull(),
    measurementResult: text("measurement_result").notNull(),
    experimentName: text("experiment_name").notNull(),
    protocolName: text("protocol_name").notNull(),
    timestamp: text("timestamp").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    // Pre-extracted at save time so the list query never has to decompress
    // measurement_result. Nullable for legacy rows pending backfill.
    questionsText: text("questions_text"),
    hasComment: integer("has_comment", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    check(
      "measurements_status_check",
      sql`${table.status} IN ('pending', 'uploading', 'failed', 'successful')`,
    ),
    index("idx_measurements_status").on(table.status),
    index("idx_measurements_status_ts").on(table.status, table.timestamp),
    index("idx_measurements_created_at").on(table.createdAt),
  ],
);

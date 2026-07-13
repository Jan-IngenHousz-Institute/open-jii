import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Measurement lifecycle:
 *   pending     - saved locally, not yet acknowledged by the broker.
 *   failed      - Outbox exhausted retries; requires user action.
 *   successful  - broker acked (QoS 1 PUBACK).
 *
 * In-flight state lives in the Outbox (Pacer AsyncQueuer), not the DB.
 * `getOutbox().isProcessing(id)` answers the "is this in flight now"
 * question for the UI; the DB never carries an "uploading" value.
 */
export const MEASUREMENT_STATUSES = ["pending", "failed", "successful"] as const;

export const measurements = sqliteTable(
  "measurements",
  {
    id: text("id").primaryKey(),
    status: text("status", { enum: MEASUREMENT_STATUSES }).notNull(),
    topic: text("topic").notNull(),
    measurementResult: text("measurement_result").notNull(),
    experimentName: text("experiment_name").notNull(),
    // Holds the command (formerly protocol) name; column kept to avoid a local migration.
    protocolName: text("protocol_name").notNull(),
    timestamp: text("timestamp").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    // Pre-extracted at save time so the list query never has to decompress
    // measurement_result. Nullable for legacy rows pending backfill.
    questionsText: text("questions_text"),
    hasComment: integer("has_comment", { mode: "boolean" }).notNull().default(false),
    // Local calendar date "YYYY-MM-DD" computed at save time from timestamp + resolved timezone.
    // Used to group the Recent list by day. Nullable for legacy rows pending backfill.
    dayKey: text("day_key"),
  },
  (table) => [
    check("measurements_status_check", sql`${table.status} IN ('pending', 'failed', 'successful')`),
    index("idx_measurements_status").on(table.status),
    index("idx_measurements_status_ts").on(table.status, table.timestamp),
    index("idx_measurements_created_at").on(table.createdAt),
  ],
);

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const measurements = sqliteTable("measurements", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["failed", "successful"] }).notNull(),
  topic: text("topic").notNull(),
  measurementResult: text("measurement_result").notNull(),
  experimentName: text("experiment_name").notNull(),
  protocolName: text("protocol_name").notNull(),
  timestamp: text("timestamp").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

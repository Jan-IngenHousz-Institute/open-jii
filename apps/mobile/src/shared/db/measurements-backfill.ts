import { eq, isNull } from "drizzle-orm";
import { DateTime } from "luxon";
import { parseQuestions } from "~/shared/utils/convert-cycle-answers-to-array";
import { createLogger } from "~/shared/utils/logger";
import { getCommentFromMeasurementResult } from "~/shared/utils/measurement-annotations";
import { decompressFromStorage } from "~/shared/utils/storage-compression";
import { getTimeSyncState } from "~/shared/utils/time-sync";

import { db } from "./client";
import { measurements } from "./schema";

const log = createLogger("measurements");

const BATCH_SIZE = 100;

/**
 * Populate the derived list-only columns (`questions_text`, `has_comment`, `day_key`)
 * for rows that pre-date migration 0004. New saves write these columns
 * directly; this runs once at app launch to catch the legacy rows.
 *
 * Done in batches with `setTimeout(0)` yields between batches so the UI stays
 * responsive while a large library decompresses ~150 KB payloads one at a time.
 * Failed rows are marked with `questions_text = "[]"` and `day_key = ""` so we
 * don't retry them forever — they'll still open correctly via getMeasurement(id)
 * since that decompresses on demand.
 */
export async function backfillDerivedColumns(): Promise<void> {
  let totalUpdated = 0;
  const timeSyncState = getTimeSyncState();

  while (true) {
    const rows = db
      .select({ id: measurements.id, measurementResult: measurements.measurementResult, timestamp: measurements.timestamp })
      .from(measurements)
      .where(isNull(measurements.questionsText))
      .limit(BATCH_SIZE)
      .all();
    if (rows.length === 0) break;

    // CPU-heavy decompress + parse runs outside the transaction so SQLite's
    // write lock is held only for the cheap UPDATE statements.
    const updates = rows.map((row) => {
      try {
        const result = decompressFromStorage<Record<string, unknown>>(row.measurementResult);
        
        // Compute day_key from timestamp + resolved timezone
        let dayKey = "";
        try {
          const dt = DateTime.fromISO(row.timestamp, { zone: "utc" }).setZone(timeSyncState.timezone);
          const formatted = dt.toFormat("yyyy-MM-dd");
          dayKey = formatted && formatted !== "Invalid DateTime" ? formatted : "";
        } catch {
          // Fallback: empty dayKey
          dayKey = "";
        }

        return {
          id: row.id,
          questionsText: JSON.stringify(parseQuestions(result)),
          hasComment: !!getCommentFromMeasurementResult(result),
          dayKey,
        };
      } catch {
        return { id: row.id, questionsText: "[]", hasComment: false, dayKey: "" };
      }
    });

    db.transaction((tx) => {
      for (const u of updates) {
        tx.update(measurements)
          .set({ questionsText: u.questionsText, hasComment: u.hasComment, dayKey: u.dayKey })
          .where(eq(measurements.id, u.id))
          .run();
      }
    });

    totalUpdated += rows.length;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (totalUpdated > 0) {
    log.info("backfilled derived columns", { count: totalUpdated });
  }
}

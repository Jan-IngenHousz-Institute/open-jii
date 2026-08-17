import { and, eq, isNull, or } from "drizzle-orm";
import { decompressFromStorage } from "~/shared/compression/storage-compression";
import { parseQuestions } from "~/shared/measurements/convert-cycle-answers-to-array";
import { getCommentFromMeasurementResult } from "~/shared/measurements/measurement-annotations";
import { createLogger } from "~/shared/observability/logger";

import { db } from "./client";
import { computeDayKey, extractWorkbookRunId } from "./measurements-storage";
import { measurements } from "./schema";

const log = createLogger("measurements");

const BATCH_SIZE = 100;

/**
 * Populate the derived list-only columns (`questions_text`, `has_comment`,
 * `day_key`, `workbook_run_id`) for rows that pre-date migrations 0004/0005.
 * New saves write these columns directly; this runs once at app launch to catch
 * the legacy rows.
 *
 * Done in batches with `setTimeout(0)` yields between batches so the UI stays
 * responsive while a large library decompresses ~150 KB payloads one at a time.
 * Every pass writes non-null values (`questions_text = "[]"`, `workbook_run_id
 * = ""` when the payload has none), so a row is never rescanned forever; it
 * still opens correctly via getMeasurement(id), which decompresses on demand.
 *
 * Returns how many rows were actually updated. The UPDATEs are guarded on the
 * row still needing backfill, so a row a concurrent write (comment edit,
 * updateMeasurement) fully populated after the batch snapshot is skipped
 * instead of being reverted to the stale snapshot.
 */
export async function backfillDerivedColumns(): Promise<number> {
  let totalUpdated = 0;

  while (true) {
    const rows = db
      .select({
        id: measurements.id,
        measurementResult: measurements.measurementResult,
        timestamp: measurements.timestamp,
        questionsText: measurements.questionsText,
        hasComment: measurements.hasComment,
        workbookRunId: measurements.workbookRunId,
      })
      .from(measurements)
      // Catch pre-0003 rows (no questions_text) plus rows backfilled by an
      // earlier pass that still have a null day_key or workbook_run_id.
      .where(
        or(
          isNull(measurements.questionsText),
          isNull(measurements.dayKey),
          isNull(measurements.workbookRunId),
        ),
      )
      .limit(BATCH_SIZE)
      .all();
    if (rows.length === 0) break;

    // CPU-heavy decompress + parse runs outside the transaction so SQLite's
    // write lock is held only for the cheap UPDATE statements.
    const updates = rows.map((row) => {
      try {
        const result = decompressFromStorage<Record<string, unknown>>(row.measurementResult);
        return {
          id: row.id,
          questionsText: JSON.stringify(parseQuestions(result)),
          hasComment: !!getCommentFromMeasurementResult(result),
          dayKey: computeDayKey(row.timestamp),
          workbookRunId: extractWorkbookRunId(result),
        };
      } catch {
        // Decompress/parse failed: only backfill what's actually missing so we
        // don't clobber values already populated by an earlier backfill pass
        // (e.g. a row that just needs its day_key derived).
        return {
          id: row.id,
          questionsText: row.questionsText ?? "[]",
          hasComment: row.hasComment ?? false,
          dayKey: computeDayKey(row.timestamp),
          workbookRunId: row.workbookRunId ?? "",
        };
      }
    });

    db.transaction((tx) => {
      for (const u of updates) {
        // Guarded: skip the row when a concurrent write already populated all
        // derived columns since the batch snapshot was read — otherwise a
        // comment edited mid-backfill would be reverted to the stale snapshot.
        const result = tx
          .update(measurements)
          .set({
            questionsText: u.questionsText,
            hasComment: u.hasComment,
            dayKey: u.dayKey,
            workbookRunId: u.workbookRunId,
          })
          .where(
            and(
              eq(measurements.id, u.id),
              or(
                isNull(measurements.questionsText),
                isNull(measurements.dayKey),
                isNull(measurements.workbookRunId),
              ),
            ),
          )
          .run();
        totalUpdated += result.changes;
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (totalUpdated > 0) {
    log.info("backfilled derived columns", { count: totalUpdated });
  }
  return totalUpdated;
}

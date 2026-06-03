import AsyncStorage from "@react-native-async-storage/async-storage";
import { eq, and, gte, lt, inArray, count, desc } from "drizzle-orm";
import { DateTime, Duration } from "luxon";
import { v4 as uuidv4 } from "uuid";
import {
  compressForStorage,
  decompressFromStorage,
} from "~/shared/compression/storage-compression";
import type { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";
import { parseQuestions } from "~/shared/measurements/convert-cycle-answers-to-array";
import { getCommentFromMeasurementResult } from "~/shared/measurements/measurement-annotations";
import { createLogger } from "~/shared/observability/logger";

import { db } from "./client";
import { measurements } from "./schema";

const log = createLogger("measurements");

const LEGACY_PREFIXES = [
  { prefix: "FAILED_UPLOAD_", status: "failed" as const },
  { prefix: "SUCCESSFUL_UPLOAD_", status: "successful" as const },
];

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type MeasurementStatus = "pending" | "failed" | "successful";

export interface Measurement {
  topic: string;
  measurementResult: object;
  metadata: { experimentName: string; protocolName: string; timestamp: string };
}

let migrationPromise: Promise<void> | null = null;

async function migrateLegacyEntries(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();

  for (const { prefix, status } of LEGACY_PREFIXES) {
    const legacyKeys = allKeys.filter((k) => k.startsWith(prefix));
    if (legacyKeys.length === 0) continue;

    const entries = await AsyncStorage.multiGet(legacyKeys);
    const migratedKeys: string[] = [];

    for (const [key, value] of entries) {
      if (!value) continue;
      try {
        const parsed = decompressFromStorage<Measurement>(value);
        if (!isValidMeasurement(parsed)) continue;

        const id = key.replace(prefix, "");
        const createdAtDate = new Date(parsed.metadata.timestamp);
        const createdAt = isFinite(createdAtDate.getTime()) ? { createdAt: createdAtDate } : {};
        const derived = deriveListColumns(parsed.measurementResult, parsed.metadata.timestamp);

        db.insert(measurements)
          .values({
            id,
            status,
            topic: parsed.topic,
            measurementResult: compressForStorage(parsed.measurementResult),
            experimentName: parsed.metadata.experimentName,
            protocolName: parsed.metadata.protocolName,
            timestamp: parsed.metadata.timestamp,
            questionsText: derived.questionsText,
            hasComment: derived.hasComment,
            dayKey: derived.dayKey,
            ...createdAt,
          })
          .onConflictDoNothing()
          .run();

        migratedKeys.push(key);
      } catch {
        // Skip corrupt entries
      }
    }

    await AsyncStorage.multiRemove(migratedKeys);
    log.info("migrated legacy entries", { count: legacyKeys.length, status });
  }
}

async function ensureMigrated(): Promise<void> {
  if (migrationPromise) {
    await migrationPromise;
    return;
  }
  migrationPromise = (async () => {
    try {
      await migrateLegacyEntries();
    } catch (err) {
      migrationPromise = null;
      log.warn("Legacy migration failed", { err: (err as Error)?.message });
      throw err;
    }
  })();
  await migrationPromise;
}

export async function saveMeasurement(
  upload: Measurement,
  status: MeasurementStatus,
): Promise<string> {
  await ensureMigrated();
  const id = uuidv4();
  const derived = deriveListColumns(upload.measurementResult, upload.metadata.timestamp);
  db.insert(measurements)
    .values({
      id,
      status,
      topic: upload.topic,
      measurementResult: compressForStorage(upload.measurementResult),
      experimentName: upload.metadata.experimentName,
      protocolName: upload.metadata.protocolName,
      timestamp: upload.metadata.timestamp,
      questionsText: derived.questionsText,
      hasComment: derived.hasComment,
      dayKey: derived.dayKey,
    })
    .run();
  return id;
}

// Computed at save/update time so the list query never decompresses
// measurement_result. Keep this in sync with the schema columns.
function deriveListColumns(
  measurementResult: object,
  timestamp: string,
): {
  questionsText: string;
  hasComment: boolean;
  dayKey: string;
} {
  return {
    questionsText: JSON.stringify(parseQuestions(measurementResult)),
    hasComment: !!getCommentFromMeasurementResult(measurementResult as Record<string, unknown>),
    dayKey: computeDayKey(timestamp),
  };
}

// Local calendar date "YYYY-MM-DD" for `timestamp`, resolved in the device's
// timezone, so the Recent list buckets by day without parsing the timestamp
// per row at render time. Defaults to today when the timestamp is unparseable.
// Uses the device tz (Intl) rather than the synced tz so the DB layer stays
// free of the time-sync service's native deps; for day-bucketing the two are
// equivalent in practice. See OJD-1470.
export function computeDayKey(timestamp: string): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    const dt = DateTime.fromISO(timestamp, { zone: "utc" }).setZone(zone);
    if (dt.isValid) return dt.toFormat("yyyy-MM-dd");
  } catch {
    // fall through to today
  }
  return DateTime.now().setZone(zone).toFormat("yyyy-MM-dd");
}

// `questions_text` is plain JSON written by `deriveListColumns`. A malformed
// row (legacy data, manual edit, partial migration) shouldn't break the whole
// list — fall back to an empty array for just that row. We also reject
// non-array shapes so a stray `null`, `{}`, or string can't masquerade as
// `AnswerData[]` and crash downstream.
function safeParseQuestionsText(text: string | null, id: string): AnswerData[] {
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      console.warn(`[measurements] questions_text not an array for ${id}:`, typeof parsed);
      return [];
    }
    return parsed as AnswerData[];
  } catch (err) {
    console.warn(`[measurements] questions_text malformed for ${id}:`, err);
    return [];
  }
}

export interface StoredMeasurement {
  id: string;
  status: MeasurementStatus;
  data: Measurement;
}

export type MeasurementCounts = Record<MeasurementStatus, number>;

export async function countMeasurementsByStatus(): Promise<MeasurementCounts> {
  await ensureMigrated();
  try {
    const rows = db
      .select({ status: measurements.status, total: count() })
      .from(measurements)
      .groupBy(measurements.status)
      .all();
    const out: MeasurementCounts = { pending: 0, failed: 0, successful: 0 };
    for (const r of rows) {
      out[r.status] = r.total;
    }
    return out;
  } catch (error) {
    log.error("Failed to count measurements", { err: (error as Error)?.message });
    return { pending: 0, failed: 0, successful: 0 };
  }
}

/**
 * Count measurements per experiment name since `sinceIso` (an ISO timestamp).
 * Used to surface recently-active experiments first in the flow picker.
 * `timestamp` is stored as a UTC ISO string, so a lexicographic `>=` compare
 * is a correct time filter.
 */
export async function countRecentMeasurementsByExperiment(
  sinceIso: string,
): Promise<Record<string, number>> {
  await ensureMigrated();
  try {
    const rows = db
      .select({ name: measurements.experimentName, total: count() })
      .from(measurements)
      .where(gte(measurements.timestamp, sinceIso))
      .groupBy(measurements.experimentName)
      .all();
    const out: Record<string, number> = {};
    for (const r of rows) out[r.name] = r.total;
    return out;
  } catch (error) {
    log.error("Failed to count recent measurements by experiment", {
      err: (error as Error)?.message,
    });
    return {};
  }
}

/**
 * Row shape returned by `getMeasurementsList` — exactly what the list UI
 * needs to render a row, with no compressed blob. `questions` is already
 * parsed from the `questions_text` plain-text column populated at save time.
 * `hasComment` powers the row badge without touching `measurement_result`.
 */
export interface MeasurementListRow {
  id: string;
  status: MeasurementStatus;
  experimentName: string;
  protocolName: string;
  timestamp: string;
  questions: AnswerData[];
  hasComment: boolean;
  dayKey: string;
}

/**
 * Lean fetch for the list screen. Never reads `measurement_result`, never
 * decompresses, never runs Zod. Driven by SQL `ORDER BY timestamp DESC` with
 * a covering index from migration 0002. Use `getMeasurement(id)` to load the
 * full payload when the detail modal opens.
 */
export async function getMeasurementsList(
  status: MeasurementStatus[],
  opts: { limit: number; offset: number },
): Promise<MeasurementListRow[]> {
  await ensureMigrated();
  if (status.length === 0) return [];
  try {
    const rows = db
      .select({
        id: measurements.id,
        status: measurements.status,
        experimentName: measurements.experimentName,
        protocolName: measurements.protocolName,
        timestamp: measurements.timestamp,
        questionsText: measurements.questionsText,
        hasComment: measurements.hasComment,
        dayKey: measurements.dayKey,
      })
      .from(measurements)
      .where(inArray(measurements.status, status))
      // `id` tiebreaker keeps pages stable when several rows share a timestamp;
      // otherwise OFFSET pagination can duplicate or skip rows between pages.
      .orderBy(desc(measurements.timestamp), desc(measurements.id))
      .limit(opts.limit)
      .offset(opts.offset)
      .all();
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      experimentName: r.experimentName,
      protocolName: r.protocolName,
      timestamp: r.timestamp,
      // Legacy rows pending backfill have questionsText === null; treat as
      // empty. One malformed questions_text falls back per-row so the rest
      // of the list still renders.
      questions: safeParseQuestionsText(r.questionsText, r.id),
      hasComment: !!r.hasComment,
      dayKey: r.dayKey ?? "",
    }));
  } catch (error) {
    log.error("Failed to fetch measurements list", { err: (error as Error)?.message });
    return [];
  }
}

/**
 * Fetch a single full row by id, including the decompressed
 * `measurementResult`. Used by the detail modal on open and by paths that
 * need the full payload (comment editing, MQTT publish).
 */
export async function getMeasurement(id: string): Promise<StoredMeasurement | null> {
  await ensureMigrated();
  try {
    const row = db.select().from(measurements).where(eq(measurements.id, id)).get();
    if (!row) return null;
    return {
      id: row.id,
      status: row.status,
      data: {
        topic: row.topic,
        measurementResult: decompressFromStorage(row.measurementResult),
        metadata: {
          experimentName: row.experimentName,
          protocolName: row.protocolName,
          timestamp: row.timestamp,
        },
      },
    };
  } catch (error) {
    log.error("Failed to fetch measurement by id", { id, err: (error as Error)?.message });
    return null;
  }
}

export async function getMeasurements(
  status: MeasurementStatus | MeasurementStatus[],
): Promise<StoredMeasurement[]> {
  try {
    await ensureMigrated();
    const statusList = Array.isArray(status) ? status : [status];
    if (statusList.length === 0) return [];
    const whereClause =
      statusList.length === 1
        ? eq(measurements.status, statusList[0])
        : inArray(measurements.status, statusList);
    const rows = db.select().from(measurements).where(whereClause).all();

    return rows
      .map((row): StoredMeasurement | null => {
        try {
          return {
            id: row.id,
            status: row.status,
            data: {
              topic: row.topic,
              measurementResult: decompressFromStorage(row.measurementResult),
              metadata: {
                experimentName: row.experimentName,
                protocolName: row.protocolName,
                timestamp: row.timestamp,
              },
            },
          };
        } catch {
          return null;
        }
      })
      .filter((m): m is StoredMeasurement => m !== null);
  } catch (error) {
    log.error("Failed to fetch measurements", { err: (error as Error)?.message });
    throw error;
  }
}

// Alias kept for call sites that read by id (e.g. the Outbox worker). The
// query/decompress/error-handling lives once in getMeasurement; this wraps
// it so the two can't drift.
export async function getMeasurementById(id: string): Promise<StoredMeasurement | null> {
  return getMeasurement(id);
}

export async function updateMeasurement(key: string, data: Measurement): Promise<void> {
  await ensureMigrated();
  try {
    const derived = deriveListColumns(data.measurementResult, data.metadata.timestamp);
    db.update(measurements)
      .set({
        topic: data.topic,
        measurementResult: compressForStorage(data.measurementResult),
        experimentName: data.metadata.experimentName,
        protocolName: data.metadata.protocolName,
        timestamp: data.metadata.timestamp,
        questionsText: derived.questionsText,
        hasComment: derived.hasComment,
        dayKey: derived.dayKey,
      })
      .where(eq(measurements.id, key))
      .run();
  } catch (error) {
    log.error("Failed to update measurement", { key, err: (error as Error)?.message });
  }
}

export async function markAsFailed(key: string): Promise<void> {
  await ensureMigrated();
  try {
    db.update(measurements)
      .set({ status: "failed" })
      .where(and(eq(measurements.id, key), eq(measurements.status, "pending")))
      .run();
  } catch (error) {
    log.error("Failed to mark measurement as failed", { key, err: (error as Error)?.message });
  }
}

export async function markAsSuccessful(key: string): Promise<void> {
  await ensureMigrated();
  try {
    // Accept transitions from any pre-success state. A retry of a previously
    // "failed" row that finally goes through still ends at "successful".
    db.update(measurements)
      .set({ status: "successful" })
      .where(and(eq(measurements.id, key), inArray(measurements.status, ["pending", "failed"])))
      .run();
  } catch (error) {
    log.error("Failed to mark measurement as successful", { key, err: (error as Error)?.message });
  }
}

export async function removeMeasurement(key: string): Promise<void> {
  await ensureMigrated();
  try {
    db.delete(measurements).where(eq(measurements.id, key)).run();
  } catch (error) {
    log.error("Failed to remove measurement", { key, err: (error as Error)?.message });
  }
}

export async function clearMeasurements(status: MeasurementStatus): Promise<void> {
  await ensureMigrated();
  try {
    db.delete(measurements).where(eq(measurements.status, status)).run();
  } catch (error) {
    log.error("Failed to clear measurements", { status, err: (error as Error)?.message });
  }
}

export async function pruneExpiredMeasurements(): Promise<void> {
  await ensureMigrated();
  try {
    const cutoff = new Date(Date.now() - MAX_AGE_MS);
    const result = db
      .delete(measurements)
      .where(and(eq(measurements.status, "successful"), lt(measurements.createdAt, cutoff)))
      .run();
    log.info("pruned successful uploads", {
      count: result.changes,
      older_than_days: Duration.fromMillis(MAX_AGE_MS).as("days"),
    });
  } catch (error) {
    log.warn("Prune failed", { err: (error as Error)?.message });
  }
}

function isValidMeasurement(obj: any): obj is Measurement {
  return (
    typeof obj === "object" &&
    typeof obj.topic === "string" &&
    typeof obj.measurementResult === "object" &&
    typeof obj.metadata === "object"
  );
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { eq, and, lt, inArray, count, desc } from "drizzle-orm";
import { Duration } from "luxon";
import { v4 as uuidv4 } from "uuid";
import type { AnswerData } from "~/shared/utils/convert-cycle-answers-to-array";
import { parseQuestions } from "~/shared/utils/convert-cycle-answers-to-array";
import { getCommentFromMeasurementResult } from "~/shared/utils/measurement-annotations";
import { compressForStorage, decompressFromStorage } from "~/shared/utils/storage-compression";

import { db } from "./client";
import { measurements } from "./schema";

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
        const derived = deriveListColumns(parsed.measurementResult);

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
    console.log(`[measurements] Migrated ${legacyKeys.length} ${status} entries from AsyncStorage`);
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
      console.warn("[measurements] Legacy migration failed:", err);
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
  const derived = deriveListColumns(upload.measurementResult);
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
    })
    .run();
  return id;
}

// Computed at save/update time so the list query never decompresses
// measurement_result. Keep this in sync with the schema columns.
function deriveListColumns(measurementResult: object): {
  questionsText: string;
  hasComment: boolean;
} {
  return {
    questionsText: JSON.stringify(parseQuestions(measurementResult)),
    hasComment: !!getCommentFromMeasurementResult(measurementResult as Record<string, unknown>),
  };
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
    console.error("Failed to count measurements:", error);
    return { pending: 0, failed: 0, successful: 0 };
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
    }));
  } catch (error) {
    console.error("Failed to fetch measurements list:", error);
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
    console.error("Failed to fetch measurement by id:", error);
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
    console.error("Failed to fetch measurements:", error);
    throw error;
  }
}

export async function getMeasurementById(id: string): Promise<StoredMeasurement | null> {
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
    console.error("Failed to fetch measurement by id:", error);
    return null;
  }
}

export async function updateMeasurement(key: string, data: Measurement): Promise<void> {
  await ensureMigrated();
  try {
    const derived = deriveListColumns(data.measurementResult);
    db.update(measurements)
      .set({
        topic: data.topic,
        measurementResult: compressForStorage(data.measurementResult),
        experimentName: data.metadata.experimentName,
        protocolName: data.metadata.protocolName,
        timestamp: data.metadata.timestamp,
        questionsText: derived.questionsText,
        hasComment: derived.hasComment,
      })
      .where(eq(measurements.id, key))
      .run();
  } catch (error) {
    console.error("Failed to update measurement:", error);
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
    console.error("Failed to mark measurement as failed:", error);
  }
}

export async function markAsSuccessful(key: string): Promise<void> {
  await ensureMigrated();
  try {
    // Accept transitions from any pre-success state. A retry of a previously
    // "failed" row that finally goes through still ends at "successful".
    db.update(measurements)
      .set({ status: "successful" })
      .where(
        and(eq(measurements.id, key), inArray(measurements.status, ["pending", "failed"])),
      )
      .run();
  } catch (error) {
    console.error("Failed to mark measurement as successful:", error);
  }
}

export async function removeMeasurement(key: string): Promise<void> {
  await ensureMigrated();
  try {
    db.delete(measurements).where(eq(measurements.id, key)).run();
  } catch (error) {
    console.error("Failed to remove measurement:", error);
  }
}

export async function clearMeasurements(status: MeasurementStatus): Promise<void> {
  await ensureMigrated();
  try {
    db.delete(measurements).where(eq(measurements.status, status)).run();
  } catch (error) {
    console.error("Failed to clear measurements:", error);
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
    console.log(
      `[measurements] Pruned ${result.changes} successful uploads older than ${Duration.fromMillis(MAX_AGE_MS).as("days")} days`,
    );
  } catch (error) {
    console.warn("[measurements] Prune failed:", error);
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

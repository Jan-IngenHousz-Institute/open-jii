import AsyncStorage from "@react-native-async-storage/async-storage";
import { eq, and, lt } from "drizzle-orm";
import { Duration } from "luxon";
import { v4 as uuidv4 } from "uuid";
import { compressForStorage, decompressFromStorage } from "~/utils/storage-compression";

import { db } from "./db/client";
import { measurements } from "./db/schema";

const LEGACY_PREFIXES = [
  { prefix: "FAILED_UPLOAD_", status: "failed" as const },
  { prefix: "SUCCESSFUL_UPLOAD_", status: "successful" as const },
];

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type MeasurementStatus = "failed" | "uploading" | "successful";

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

        db.insert(measurements)
          .values({
            id,
            status,
            topic: parsed.topic,
            measurementResult: compressForStorage(parsed.measurementResult),
            experimentName: parsed.metadata.experimentName,
            protocolName: parsed.metadata.protocolName,
            timestamp: parsed.metadata.timestamp,
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
): Promise<void> {
  await ensureMigrated();
  db.insert(measurements)
    .values({
      id: uuidv4(),
      status,
      topic: upload.topic,
      measurementResult: compressForStorage(upload.measurementResult),
      experimentName: upload.metadata.experimentName,
      protocolName: upload.metadata.protocolName,
      timestamp: upload.metadata.timestamp,
    })
    .run();
}

export async function getMeasurements(status: MeasurementStatus): Promise<[string, Measurement][]> {
  try {
    await ensureMigrated();
    const rows = db.select().from(measurements).where(eq(measurements.status, status)).all();

    return rows
      .map((row) => {
        try {
          const measurement: Measurement = {
            topic: row.topic,
            measurementResult: decompressFromStorage(row.measurementResult),
            metadata: {
              experimentName: row.experimentName,
              protocolName: row.protocolName,
              timestamp: row.timestamp,
            },
          };
          return [row.id, measurement] as [string, Measurement];
        } catch {
          return null;
        }
      })
      .filter(Boolean) as [string, Measurement][];
  } catch (error) {
    console.error("Failed to fetch measurements:", error);
    throw error;
  }
}

export async function updateMeasurement(key: string, data: Measurement): Promise<void> {
  await ensureMigrated();
  try {
    db.update(measurements)
      .set({
        topic: data.topic,
        measurementResult: compressForStorage(data.measurementResult),
        experimentName: data.metadata.experimentName,
        protocolName: data.metadata.protocolName,
        timestamp: data.metadata.timestamp,
      })
      .where(eq(measurements.id, key))
      .run();
  } catch (error) {
    console.error("Failed to update measurement:", error);
  }
}

export async function markAsUploading(keys: string[]): Promise<void> {
  await ensureMigrated();
  try {
    for (const key of keys) {
      db.update(measurements)
        .set({ status: "uploading" })
        .where(and(eq(measurements.id, key), eq(measurements.status, "failed")))
        .run();
    }
  } catch (error) {
    console.error("Failed to mark measurements as uploading:", error);
  }
}

export async function markAsFailed(key: string): Promise<void> {
  await ensureMigrated();
  try {
    db.update(measurements)
      .set({ status: "failed" })
      .where(and(eq(measurements.id, key), eq(measurements.status, "uploading")))
      .run();
  } catch (error) {
    console.error("Failed to revert measurement to failed:", error);
  }
}

export async function resetUploadingMeasurements(): Promise<void> {
  await ensureMigrated();
  try {
    db.update(measurements)
      .set({ status: "failed" })
      .where(eq(measurements.status, "uploading"))
      .run();
  } catch (error) {
    console.error("Failed to reset uploading measurements:", error);
  }
}

export async function markAsSuccessful(key: string): Promise<void> {
  await ensureMigrated();
  try {
    db.update(measurements)
      .set({ status: "successful" })
      .where(and(eq(measurements.id, key), eq(measurements.status, "uploading")))
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

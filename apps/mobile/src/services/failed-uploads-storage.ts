import AsyncStorage from "@react-native-async-storage/async-storage";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { compressForStorage, decompressFromStorage } from "~/utils/storage-compression";

import { db } from "./db/client";
import { measurements } from "./db/schema";

const LEGACY_KEY_PREFIX = "FAILED_UPLOAD_";

export interface FailedUpload {
  topic: string;
  measurementResult: object;
  metadata: { experimentName: string; protocolName: string; timestamp: string };
}

/** Migrate any remaining AsyncStorage entries to SQLite, then delete them. */
async function migrateLegacyEntries(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const legacyKeys = allKeys.filter((k) => k.startsWith(LEGACY_KEY_PREFIX));
    if (legacyKeys.length === 0) return;

    const entries = await AsyncStorage.multiGet(legacyKeys);

    for (const [key, value] of entries) {
      if (!value) continue;
      try {
        const parsed = decompressFromStorage<FailedUpload>(value);
        if (!isValidFailedUpload(parsed)) continue;

        const id = key.replace(LEGACY_KEY_PREFIX, "");
        db.insert(measurements)
          .values({
            id,
            status: "failed",
            topic: parsed.topic,
            measurementResult: compressForStorage(parsed.measurementResult),
            experimentName: parsed.metadata.experimentName,
            protocolName: parsed.metadata.protocolName,
            timestamp: parsed.metadata.timestamp,
          })
          .onConflictDoNothing()
          .run();
      } catch {
        // Skip corrupt entries
      }
    }

    await AsyncStorage.multiRemove(legacyKeys);
    console.log(`[failed-uploads] Migrated ${legacyKeys.length} entries from AsyncStorage`);
  } catch (err) {
    console.warn("[failed-uploads] Legacy migration failed:", err);
  }
}

let migrationDone = false;

async function ensureMigrated(): Promise<void> {
  if (migrationDone) return;
  await migrateLegacyEntries();
  migrationDone = true;
}

export async function saveFailedUpload(upload: FailedUpload): Promise<void> {
  await ensureMigrated();
  db.insert(measurements)
    .values({
      id: uuidv4(),
      status: "failed",
      topic: upload.topic,
      measurementResult: compressForStorage(upload.measurementResult),
      experimentName: upload.metadata.experimentName,
      protocolName: upload.metadata.protocolName,
      timestamp: upload.metadata.timestamp,
    })
    .run();
}

export async function getFailedUploadsWithKeys(): Promise<[string, FailedUpload][]> {
  try {
    await ensureMigrated();
    const rows = db.select().from(measurements).where(eq(measurements.status, "failed")).all();

    return rows
      .map((row) => {
        try {
          const upload: FailedUpload = {
            topic: row.topic,
            measurementResult: decompressFromStorage(row.measurementResult),
            metadata: {
              experimentName: row.experimentName,
              protocolName: row.protocolName,
              timestamp: row.timestamp,
            },
          };
          return [row.id, upload] as [string, FailedUpload];
        } catch {
          return null;
        }
      })
      .filter(Boolean) as [string, FailedUpload][];
  } catch (error) {
    console.error("Failed to fetch uploads:", error);
    return [];
  }
}

export async function updateFailedUpload(key: string, data: FailedUpload): Promise<void> {
  try {
    await ensureMigrated();
    db.update(measurements)
      .set({
        topic: data.topic,
        measurementResult: compressForStorage(data.measurementResult),
        experimentName: data.metadata.experimentName,
        protocolName: data.metadata.protocolName,
        timestamp: data.metadata.timestamp,
      })
      .where(and(eq(measurements.id, key), eq(measurements.status, "failed")))
      .run();
  } catch (error) {
    console.error("Failed to update upload:", error);
  }
}

export function markFailedUploadAsSuccessful(key: string): void {
  try {
    db.update(measurements)
      .set({ status: "successful" })
      .where(and(eq(measurements.id, key), eq(measurements.status, "failed")))
      .run();
  } catch (error) {
    console.error("Failed to mark upload as successful:", error);
  }
}

export function removeFailedUpload(key: string): void {
  try {
    db.delete(measurements)
      .where(and(eq(measurements.id, key), eq(measurements.status, "failed")))
      .run();
  } catch (error) {
    console.error("Failed to remove upload:", error);
  }
}

export function clearFailedUploads(): void {
  try {
    db.delete(measurements).where(eq(measurements.status, "failed")).run();
  } catch (error) {
    console.error("Failed to clear uploads:", error);
  }
}

function isValidFailedUpload(obj: any): obj is FailedUpload {
  return (
    typeof obj === "object" &&
    typeof obj.topic === "string" &&
    typeof obj.measurementResult === "object" &&
    typeof obj.metadata === "object"
  );
}

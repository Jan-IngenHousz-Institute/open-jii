import AsyncStorage from "@react-native-async-storage/async-storage";
import { eq, and, lt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { compressForStorage, decompressFromStorage } from "~/utils/storage-compression";

import { db } from "./db/client";
import { measurements } from "./db/schema";

const LEGACY_KEY_PREFIX = "SUCCESSFUL_UPLOAD_";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SuccessfulUpload {
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
        const parsed = decompressFromStorage<SuccessfulUpload>(value);
        if (!isValidSuccessfulUpload(parsed)) continue;

        const id = key.replace(LEGACY_KEY_PREFIX, "");
        db.insert(measurements)
          .values({
            id,
            status: "successful",
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
    console.log(`[successful-uploads] Migrated ${legacyKeys.length} entries from AsyncStorage`);
  } catch (err) {
    console.warn("[successful-uploads] Legacy migration failed:", err);
  }
}

let migrationDone = false;

async function ensureMigrated(): Promise<void> {
  if (migrationDone) return;
  await migrateLegacyEntries();
  migrationDone = true;
}

/** Delete successful uploads older than 7 days. */
export function pruneExpiredUploads(): void {
  try {
    const cutoff = new Date(Date.now() - MAX_AGE_MS);
    const result = db
      .delete(measurements)
      .where(and(eq(measurements.status, "successful"), lt(measurements.createdAt, cutoff)))
      .run();
    if (result.changes > 0) {
      console.log(`[successful-uploads] Pruned ${result.changes} uploads older than 7 days`);
    }
  } catch (error) {
    console.warn("[successful-uploads] Prune failed:", error);
  }
}

export async function saveSuccessfulUpload(upload: SuccessfulUpload): Promise<void> {
  try {
    await ensureMigrated();
    db.insert(measurements)
      .values({
        id: uuidv4(),
        status: "successful",
        topic: upload.topic,
        measurementResult: compressForStorage(upload.measurementResult),
        experimentName: upload.metadata.experimentName,
        protocolName: upload.metadata.protocolName,
        timestamp: upload.metadata.timestamp,
      })
      .run();
  } catch (error) {
    console.error("Failed to save successful upload:", error);
  }
}

export async function getSuccessfulUploadsWithKeys(): Promise<[string, SuccessfulUpload][]> {
  try {
    await ensureMigrated();
    const rows = db.select().from(measurements).where(eq(measurements.status, "successful")).all();

    return rows
      .map((row) => {
        try {
          const upload: SuccessfulUpload = {
            topic: row.topic,
            measurementResult: decompressFromStorage(row.measurementResult),
            metadata: {
              experimentName: row.experimentName,
              protocolName: row.protocolName,
              timestamp: row.timestamp,
            },
          };
          return [row.id, upload] as [string, SuccessfulUpload];
        } catch {
          return null;
        }
      })
      .filter(Boolean) as [string, SuccessfulUpload][];
  } catch (error) {
    console.error("Failed to fetch successful uploads:", error);
    return [];
  }
}

export function removeSuccessfulUpload(key: string): void {
  try {
    db.delete(measurements)
      .where(and(eq(measurements.id, key), eq(measurements.status, "successful")))
      .run();
  } catch (error) {
    console.error("Failed to remove successful upload:", error);
  }
}

export function clearSuccessfulUploads(): void {
  try {
    db.delete(measurements).where(eq(measurements.status, "successful")).run();
  } catch (error) {
    console.error("Failed to clear successful uploads:", error);
  }
}

function isValidSuccessfulUpload(obj: any): obj is SuccessfulUpload {
  return (
    typeof obj === "object" &&
    typeof obj.topic === "string" &&
    typeof obj.measurementResult === "object" &&
    typeof obj.metadata === "object"
  );
}

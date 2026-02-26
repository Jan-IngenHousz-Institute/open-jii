import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_KEY_PREFIX = "FAILED_UPLOAD_";

export interface FailedUpload {
  topic: string;
  measurementResult: object;
  metadata: { experimentName: string; protocolName: string; timestamp: string };
}

// Save a single failed upload
export async function saveFailedUpload(upload: FailedUpload): Promise<void> {
  try {
    const id = uuidv4();
    const key = `${UPLOAD_KEY_PREFIX}${id}`;
    await AsyncStorage.setItem(key, JSON.stringify(upload));
  } catch (error) {
    console.error("Failed to save upload:", error);
  }
}

// Get all failed uploads with their keys
export async function getFailedUploadsWithKeys(): Promise<[string, FailedUpload][]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const uploadKeys = allKeys.filter((k) => k.startsWith(UPLOAD_KEY_PREFIX));
    const entries = await AsyncStorage.multiGet(uploadKeys);

    return entries
      .map(([key, value]) => {
        try {
          const parsed = value ? JSON.parse(value) : null;
          return parsed && isValidFailedUpload(parsed) ? [key, parsed] : null;
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

// Update a single failed upload by key (e.g. to add/update annotations)
export async function updateFailedUpload(key: string, data: FailedUpload): Promise<void> {
  try {
    if (!key.startsWith(UPLOAD_KEY_PREFIX)) return;
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to update upload:", error);
  }
}

// Delete a single upload by key
export async function removeFailedUpload(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error("Failed to remove upload:", error);
  }
}

// Clear all uploads
export async function clearFailedUploads(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const uploadKeys = allKeys.filter((k) => k.startsWith(UPLOAD_KEY_PREFIX));
    await AsyncStorage.multiRemove(uploadKeys);
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

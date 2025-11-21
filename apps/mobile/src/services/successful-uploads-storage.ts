import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";

const SUCCESSFUL_UPLOAD_KEY_PREFIX = "SUCCESSFUL_UPLOAD_";

export interface SuccessfulUpload {
  topic: string;
  measurementResult: object;
  metadata: { experimentName: string; protocolName: string; timestamp: string };
}

// Save a single successful upload
export async function saveSuccessfulUpload(upload: SuccessfulUpload): Promise<void> {
  try {
    const id = uuidv4();
    const key = `${SUCCESSFUL_UPLOAD_KEY_PREFIX}${id}`;
    await AsyncStorage.setItem(key, JSON.stringify(upload));
  } catch (error) {
    console.error("Failed to save successful upload:", error);
  }
}

// Get all successful uploads with their keys
export async function getSuccessfulUploadsWithKeys(): Promise<[string, SuccessfulUpload][]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const uploadKeys = allKeys.filter((k) => k.startsWith(SUCCESSFUL_UPLOAD_KEY_PREFIX));
    const entries = await AsyncStorage.multiGet(uploadKeys);

    return entries
      .map(([key, value]) => {
        try {
          const parsed = value ? JSON.parse(value) : null;
          return parsed && isValidSuccessfulUpload(parsed) ? [key, parsed] : null;
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

// Delete a single upload by key
export async function removeSuccessfulUpload(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error("Failed to remove successful upload:", error);
  }
}

// Clear all successful uploads
export async function clearSuccessfulUploads(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const uploadKeys = allKeys.filter((k) => k.startsWith(SUCCESSFUL_UPLOAD_KEY_PREFIX));
    await AsyncStorage.multiRemove(uploadKeys);
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

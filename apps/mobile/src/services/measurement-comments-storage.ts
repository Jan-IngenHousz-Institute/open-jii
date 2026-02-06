import AsyncStorage from "@react-native-async-storage/async-storage";

const COMMENT_KEY_PREFIX = "MEASUREMENT_COMMENT_";

export interface MeasurementComment {
  measurementKey: string;
  comment: string;
  timestamp: string;
}

// Save or update a comment for a measurement
export async function saveMeasurementComment(
  measurementKey: string,
  comment: string,
): Promise<void> {
  try {
    const key = `${COMMENT_KEY_PREFIX}${measurementKey}`;
    const commentData: MeasurementComment = {
      measurementKey,
      comment,
      timestamp: new Date().toISOString(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(commentData));
  } catch (error) {
    console.error("Failed to save comment:", error);
  }
}

// Get a comment for a specific measurement
export async function getMeasurementComment(measurementKey: string): Promise<string | null> {
  try {
    const key = `${COMMENT_KEY_PREFIX}${measurementKey}`;
    const value = await AsyncStorage.getItem(key);
    if (!value) {
      return null;
    }
    const commentData: MeasurementComment = JSON.parse(value);
    return commentData.comment || null;
  } catch (error) {
    console.error("Failed to get comment:", error);
    return null;
  }
}

// Get all comments
export async function getAllMeasurementComments(): Promise<Map<string, string>> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const commentKeys = allKeys.filter((k) => k.startsWith(COMMENT_KEY_PREFIX));
    const entries = await AsyncStorage.multiGet(commentKeys);

    const commentsMap = new Map<string, string>();
    entries.forEach(([key, value]) => {
      try {
        if (value) {
          const commentData: MeasurementComment = JSON.parse(value);
          commentsMap.set(commentData.measurementKey, commentData.comment);
        }
      } catch {
        // Skip invalid entries
      }
    });

    return commentsMap;
  } catch (error) {
    console.error("Failed to fetch comments:", error);
    return new Map();
  }
}

// Delete a comment for a measurement
export async function deleteMeasurementComment(measurementKey: string): Promise<void> {
  try {
    const key = `${COMMENT_KEY_PREFIX}${measurementKey}`;
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error("Failed to delete comment:", error);
  }
}
